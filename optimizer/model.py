"""VRPTW model: which officer visits which JLG meetings, in what order and when.

Built on the OR-Tools routing library (https://developers.google.com/optimization/routing):

  * vehicles = officers; each starts and ends at its own start location (depot)
  * nodes    = meetings; visiting one takes its duration (+ a buffer afterwards)
  * "Time" dimension   = the clock: meeting windows, shifts, waiting, lunch break
  * "Count" dimension  = meetings per officer (max meetings per day)
  * disjunctions       = a meeting may be skipped, at a cost that depends on priority

The solver minimises total travel time + the cost of skipped meetings.
"""

from __future__ import annotations

import time

from ortools.constraint_solver import pywrapcp, routing_enums_pb2

from .schemas import GroupIn, OptimizeRequest, OptimizeResponse, RouteOut, StopOut

DAY_MIN = 24 * 60
# A leg OSRM could not route. Longer than any day, so the solver never uses it.
UNREACHABLE_MIN = 10_000
# Arc costs are travel minutes (tens per leg). Scaling the priority penalties makes
# skipping a meeting always cost more than any detour: meetings are only dropped
# when they truly do not fit, and then low priority goes first.
PENALTY_SCALE = 100
# With "allow late arrival", a meeting may start up to 15 minutes after its latest
# start, at this cost per late minute.
LATE_ARRIVAL_MIN = 15
LATE_COST_PER_MIN = 100
# The lunch break may start up to this long after the officer's break start.
BREAK_FLEX_MIN = 90
# "Balance workload": cost per meeting of the busiest officer (span of the Count
# dimension) — the solver accepts up to ~30 extra travel minutes to move a meeting
# to a less busy officer. (A span cost on the Time dimension would make OR-Tools
# pick the clock times itself and ignore the "as early as possible" finalizers.)
BALANCE_COEFFICIENT = 30


def solve(request: OptimizeRequest) -> OptimizeResponse:
    started = time.perf_counter()
    officers, groups = request.officers, request.groups
    travel = [[UNREACHABLE_MIN if t is None else int(t) for t in row] for row in request.time_matrix]
    group_at_node = {g.node: g for g in groups}
    officer_index = {o.id: v for v, o in enumerate(officers)}

    # A node's "service": how long the officer is busy there before leaving.
    def service(node: int) -> int:
        group = group_at_node.get(node)
        return group.duration + request.buffer_min if group else 0

    manager = pywrapcp.RoutingIndexManager(
        len(travel), len(officers), [o.node for o in officers], [o.node for o in officers]
    )
    routing = pywrapcp.RoutingModel(manager)
    solver = routing.solver()

    # ── Costs: travel time on every leg ────────────────────────────────────
    def travel_cb(from_index: int, to_index: int) -> int:
        return travel[manager.IndexToNode(from_index)][manager.IndexToNode(to_index)]

    def time_cb(from_index: int, to_index: int) -> int:
        from_node = manager.IndexToNode(from_index)
        return service(from_node) + travel[from_node][manager.IndexToNode(to_index)]

    routing.SetArcCostEvaluatorOfAllVehicles(routing.RegisterTransitCallback(travel_cb))

    # ── Time dimension: cumul = clock time when a meeting starts ──────────
    # Slack (up to a whole day) lets an officer wait for a window to open.
    routing.AddDimension(routing.RegisterTransitCallback(time_cb), DAY_MIN, DAY_MIN, False, "Time")
    clock = routing.GetDimensionOrDie("Time")

    for officer in officers:
        v = officer_index[officer.id]
        clock.CumulVar(routing.Start(v)).SetRange(officer.shift_start, officer.shift_end)
        clock.CumulVar(routing.End(v)).SetRange(officer.shift_start, officer.shift_end)

    def never_visit(index: int) -> None:
        # Nodes without a disjunction are mandatory in OR-Tools; make it optional first,
        # otherwise switching it off would make the whole problem infeasible.
        routing.AddDisjunction([index], 0)
        routing.ActiveVar(index).SetValue(0)

    # A matrix node that is neither an officer's start nor a group (e.g. the start of an
    # officer not working today) is never visited.
    depots = {o.node for o in officers}
    for node in range(len(travel)):
        if node not in depots and node not in group_at_node:
            never_visit(manager.NodeToIndex(node))

    impossible: set[str] = set()
    for group in groups:
        index = manager.NodeToIndex(group.node)
        latest_start = group.window_end - group.duration  # the meeting must end inside its window
        allowed_officer = officer_index.get(group.officer_id) if group.officer_id else None
        if latest_start < group.window_start or (group.officer_id and allowed_officer is None):
            # Window shorter than the meeting, or pinned to an officer who is not working today.
            impossible.add(group.id)
            never_visit(index)
            continue

        if request.allow_late_arrival:
            clock.CumulVar(index).SetRange(group.window_start, latest_start + LATE_ARRIVAL_MIN)
            clock.SetCumulVarSoftUpperBound(index, latest_start, LATE_COST_PER_MIN)
        else:
            clock.CumulVar(index).SetRange(group.window_start, latest_start)

        # Once the order is fixed, start each meeting as early as its window allows.
        routing.AddVariableMinimizedByFinalizer(clock.CumulVar(index))
        # Optional visit: skipping it costs its (scaled) priority penalty.
        routing.AddDisjunction([index], group.penalty * PENALTY_SCALE)
        if allowed_officer is not None:
            routing.VehicleVar(index).SetValues([-1, allowed_officer])  # -1 = not visited

    # ── Count dimension: at most max_meetings per officer ─────────────────
    def count_cb(from_index: int) -> int:
        return 1 if manager.IndexToNode(from_index) in group_at_node else 0

    routing.AddDimensionWithVehicleCapacity(
        routing.RegisterUnaryTransitCallback(count_cb), 0, [o.max_meetings for o in officers], True, "Count"
    )

    # ── Lunch break: a fixed-length interval that cannot overlap a meeting ─
    visit_time = [service(manager.IndexToNode(i)) if not routing.IsEnd(i) else 0 for i in range(routing.Size())]
    for officer in officers:
        v = officer_index[officer.id]
        if officer.break_duration == 0:
            continue
        latest = max(officer.break_start, min(officer.break_start + BREAK_FLEX_MIN, officer.shift_end - officer.break_duration))
        lunch = solver.FixedDurationIntervalVar(officer.break_start, latest, officer.break_duration, False, f"break {v}")
        clock.SetBreakIntervalsOfVehicle([lunch], v, visit_time)
        routing.AddVariableMinimizedByFinalizer(lunch.StartExpr().Var())  # lunch as early as possible

    # Finalizers pick exact times once the routes are fixed, in the order they were added:
    # meetings and lunch as early as possible (above), THEN leave the branch as late as
    # possible and come back as early as possible (no idle time at the branch).
    for v in range(len(officers)):
        routing.AddVariableMaximizedByFinalizer(clock.CumulVar(routing.Start(v)))
        routing.AddVariableMinimizedByFinalizer(clock.CumulVar(routing.End(v)))

    if request.balance_workload:
        routing.GetDimensionOrDie("Count").SetGlobalSpanCostCoefficient(BALANCE_COEFFICIENT)

    # ── Search ─────────────────────────────────────────────────────────────
    params = pywrapcp.DefaultRoutingSearchParameters()
    params.first_solution_strategy = routing_enums_pb2.FirstSolutionStrategy.PATH_CHEAPEST_ARC
    params.local_search_metaheuristic = routing_enums_pb2.LocalSearchMetaheuristic.GUIDED_LOCAL_SEARCH
    params.time_limit.FromMilliseconds(int(request.time_limit_sec * 1000))
    solution = routing.SolveWithParameters(params)

    routes = [] if solution is None else [_extract_route(request, manager, routing, solution, officer) for officer in officers]
    visited = {stop.group_id for route in routes for stop in route.stops}
    dropped = [g.id for g in groups if g.id not in visited]

    return OptimizeResponse(
        status="infeasible" if not visited else "partial" if dropped else "optimal",
        solver_status=_status_name(routing.status()),
        solve_time_sec=round(time.perf_counter() - started, 3),
        routes=routes,
        dropped=dropped,
    )


def _extract_route(request: OptimizeRequest, manager, routing, solution, officer) -> RouteOut:
    """Walk one officer's route and report the times of every stop.

    The solver only fixes when each meeting STARTS. Everything else is derived: the
    officer leaves right after a meeting (or after lunch, if lunch falls in that gap),
    travels, and waits if they arrive before the meeting can start.
    """
    v = [o.id for o in request.officers].index(officer.id)
    clock = routing.GetDimensionOrDie("Time")
    travel = request.time_matrix
    groups: dict[int, GroupIn] = {g.node: g for g in request.groups}

    lunch = _break_of(solution, v)
    lunch_taken: tuple[int, int] | None = None

    def leave_after(free_at: int, next_start: int) -> int:
        """Departure time: when the officer is free, or after lunch if lunch is in this gap."""
        nonlocal lunch_taken
        if lunch and lunch_taken is None and free_at <= lunch[0] < next_start:
            lunch_taken = lunch
            return lunch[1]
        return free_at

    # The solver's answer: the order of visits and when each meeting starts.
    index = routing.Start(v)
    route_start = solution.Min(clock.CumulVar(index))
    visits: list[tuple[int, int]] = []  # (node, meeting start)
    index = solution.Value(routing.NextVar(index))
    while not routing.IsEnd(index):
        visits.append((manager.IndexToNode(index), solution.Min(clock.CumulVar(index))))
        index = solution.Value(routing.NextVar(index))
    back_by = solution.Min(clock.CumulVar(index))

    if not visits:
        return RouteOut(
            officer_id=officer.id, start=route_start, end=route_start, stops=[], return_travel=0,
            break_start=None, break_end=None, total_travel=0, total_wait=0, total_meeting=0,
        )

    # Derive the timeline leg by leg.
    stops: list[StopOut] = []
    prev_node, free_at = officer.node, route_start
    for node, start in visits:
        group = groups[node]
        departure = leave_after(free_at, start)
        if stops:
            stops[-1].departure = departure  # when the officer left the previous meeting
        leg = travel[prev_node][node] or 0
        arrival = departure + leg
        stops.append(StopOut(
            group_id=group.id, arrival=arrival, wait=max(0, start - arrival), start=start,
            end=start + group.duration, departure=start + group.duration, travel_from_prev=leg,
        ))
        prev_node, free_at = node, start + group.duration

    # Last leg: back to the start location (lunch may still come first).
    stops[-1].departure = leave_after(free_at, back_by + 1)
    return_travel = travel[prev_node][officer.node] or 0

    return RouteOut(
        officer_id=officer.id,
        start=route_start,
        end=stops[-1].departure + return_travel,
        stops=stops,
        return_travel=return_travel,
        break_start=lunch_taken[0] if lunch_taken else None,
        break_end=lunch_taken[1] if lunch_taken else None,
        total_travel=sum(s.travel_from_prev for s in stops) + return_travel,
        total_wait=sum(s.wait for s in stops),
        total_meeting=sum(s.end - s.start for s in stops),
    )


def _break_of(solution, vehicle: int) -> tuple[int, int] | None:
    """(start, end) of this officer's lunch break in the solution, if one was placed."""
    intervals = solution.IntervalVarContainer()
    for i in range(intervals.Size()):
        element = intervals.Element(i)
        if element.Var().Name() == f"break {vehicle}" and element.PerformedValue():
            return element.StartValue(), element.EndValue()
    return None


def _status_name(status: int) -> str:
    try:
        return routing_enums_pb2.RoutingSearchStatus.Value.Name(status)
    except (AttributeError, ValueError):
        return str(status)
