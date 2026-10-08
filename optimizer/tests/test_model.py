"""Scenarios for the VRPTW model (optimizer/model.py).

Most tests place points on a straight road: travel time between two points is the
distance between their positions, in minutes. Times are minutes from midnight
(9:00 = 540).
"""

import json
from pathlib import Path

from optimizer.model import solve
from optimizer.schemas import OptimizeRequest, OptimizeResponse

H = 60  # minutes per hour


def line_matrix(positions: list[int]) -> list[list[int]]:
    return [[abs(a - b) for b in positions] for a in positions]


def officer(id: str, node: int = 0, *, shift=(8 * H + 30, 17 * H + 30), lunch=13 * H, lunch_min=30, max_meetings=10) -> dict:
    return dict(id=id, node=node, shift_start=shift[0], shift_end=shift[1], break_start=lunch, break_duration=lunch_min, max_meetings=max_meetings)


def group(id: str, node: int, window: tuple[int, int], duration: int = 30, penalty: int = 300, officer_id: str | None = None) -> dict:
    return dict(id=id, node=node, window_start=window[0], window_end=window[1], duration=duration, penalty=penalty, officer_id=officer_id)


def run(matrix, officers, groups, **settings) -> OptimizeResponse:
    request = OptimizeRequest(time_matrix=matrix, officers=officers, groups=groups, time_limit_sec=1, **settings)
    result = solve(request)
    assert_timeline_is_valid(request, result)
    return result


def assert_timeline_is_valid(request: OptimizeRequest, result: OptimizeResponse) -> None:
    """Rules every solution must follow, whatever the scenario."""
    groups = {g.id: g for g in request.groups}
    officers = {o.id: o for o in request.officers}
    for route in result.routes:
        o = officers[route.officer_id]
        assert o.shift_start <= route.start and route.end <= o.shift_end, "route outside the shift"
        assert len(route.stops) <= o.max_meetings
        for stop in route.stops:
            g = groups[stop.group_id]
            assert g.window_start <= stop.start and stop.end <= g.window_end, f"{g.id} outside its window"
            assert stop.arrival + stop.wait == stop.start
            if route.break_start is not None:
                assert stop.end <= route.break_start or stop.start >= route.break_end, "meeting overlaps lunch"
        for a, b in zip(route.stops, route.stops[1:]):
            assert a.end <= b.start, "meetings overlap"
    visited = [s.group_id for r in result.routes for s in r.stops]
    assert len(visited) == len(set(visited)), "a group was visited twice"
    assert sorted(visited + result.dropped) == sorted(groups), "every group is either visited or dropped"


def stops_of(result: OptimizeResponse, officer_id: str) -> list[str]:
    return [s.group_id for r in result.routes if r.officer_id == officer_id for s in r.stops]


def test_trivial_single_officer_visits_everything():
    result = run(line_matrix([0, 10, 20]), [officer("o1")], [
        group("a", 1, (9 * H, 11 * H)),
        group("b", 2, (9 * H, 11 * H)),
    ])
    assert result.status == "optimal"
    assert sorted(stops_of(result, "o1")) == ["a", "b"]
    assert result.dropped == []


def test_time_windows_force_the_order():
    # "late" is closer to the branch, but its window is in the afternoon.
    result = run(line_matrix([0, 5, 30]), [officer("o1")], [
        group("late", 1, (15 * H, 16 * H)),
        group("early", 2, (9 * H, 10 * H)),
    ])
    assert stops_of(result, "o1") == ["early", "late"]


def test_two_officers_split_by_geography():
    # West officer starts at 0, east officer at 200; each cluster is next to one of them.
    matrix = line_matrix([0, 200, 5, 10, 195, 190])
    result = run(matrix, [officer("west", 0), officer("east", 1)], [
        group("w1", 2, (9 * H, 12 * H)), group("w2", 3, (9 * H, 12 * H)),
        group("e1", 4, (9 * H, 12 * H)), group("e2", 5, (9 * H, 12 * H)),
    ])
    assert sorted(stops_of(result, "west")) == ["w1", "w2"]
    assert sorted(stops_of(result, "east")) == ["e1", "e2"]


def test_not_enough_time_drops_low_priority_before_high():
    # A 2-hour shift fits only two of the three 45-minute meetings.
    result = run(line_matrix([0, 5, 6, 7]), [officer("o1", shift=(9 * H, 11 * H), lunch_min=0)], [
        group("high", 1, (9 * H, 11 * H), 45, penalty=1000),
        group("medium", 2, (9 * H, 11 * H), 45, penalty=300),
        group("low", 3, (9 * H, 11 * H), 45, penalty=50),
    ])
    assert result.status == "partial"
    assert result.dropped == ["low"]


def test_assigned_officer_is_respected():
    # "pinned" is right next to officer A, but only officer B may visit it.
    matrix = line_matrix([0, 50, 1])
    result = run(matrix, [officer("A", 0), officer("B", 1)], [group("pinned", 2, (9 * H, 16 * H), officer_id="B")])
    assert stops_of(result, "B") == ["pinned"]
    assert stops_of(result, "A") == []


def test_pinned_to_an_officer_who_is_not_working_is_dropped():
    result = run(line_matrix([0, 5, 8]), [officer("A")], [
        group("pinned", 1, (9 * H, 16 * H), officer_id="absent"),
        group("free", 2, (9 * H, 16 * H)),
    ])
    assert result.dropped == ["pinned"]
    assert stops_of(result, "A") == ["free"]  # the impossible group must not block the others


def test_max_meetings_per_officer():
    groups = [group(f"g{i}", i, (9 * H, 16 * H)) for i in range(1, 5)]
    result = run(line_matrix([0, 5, 10, 15, 20]), [officer("o1", max_meetings=2)], groups)
    assert len(stops_of(result, "o1")) == 2
    assert len(result.dropped) == 2


def test_lunch_break_is_placed_inside_the_day():
    # Meetings before and after lunch, so the route crosses 13:00.
    result = run(line_matrix([0, 10, 20]), [officer("o1")], [
        group("morning", 1, (11 * H, 13 * H), 60),
        group("afternoon", 2, (13 * H, 15 * H), 60),
    ])
    route = result.routes[0]
    assert route.break_start is not None
    assert 13 * H <= route.break_start and route.break_end - route.break_start == 30
    assert route.start < route.break_start < route.end


def test_meetings_start_as_early_as_possible():
    # Nothing forces a later start, so the meeting starts when its window opens.
    result = run(line_matrix([0, 10]), [officer("o1")], [group("g", 1, (11 * H, 14 * H))], balance_workload=True)
    assert result.routes[0].stops[0].start == 11 * H


def test_balance_workload_spreads_meetings():
    # Four meetings close to the branch: without balancing one officer takes them all.
    matrix = line_matrix([0, 0, 2, 3, 4, 5])  # nodes 0 and 1 are the two officers' starts
    groups = [group(f"g{i}", i + 1, (9 * H, 16 * H)) for i in range(1, 5)]
    result = run(matrix, [officer("A", 0), officer("B", 1)], groups, balance_workload=True)
    assert sorted(len(r.stops) for r in result.routes) == [2, 2]


def test_infeasible_input_drops_everything():
    # One window is shorter than its meeting; the other is outside the shift.
    result = run(line_matrix([0, 5, 10]), [officer("o1")], [
        group("too_short", 1, (9 * H, 9 * H + 20), 30),
        group("at_night", 2, (20 * H, 21 * H), 30),
    ])
    assert result.status == "infeasible"
    assert result.solver_status != "ROUTING_INFEASIBLE"  # the model itself is still solvable
    assert sorted(result.dropped) == ["at_night", "too_short"]
    assert len(result.routes) == 1 and result.routes[0].stops == []


def test_impossible_window_does_not_block_other_groups():
    result = run(line_matrix([0, 5, 10]), [officer("o1")], [
        group("too_short", 1, (9 * H, 9 * H + 20), 30),
        group("fine", 2, (9 * H, 11 * H), 30),
    ])
    assert result.status == "partial"
    assert result.dropped == ["too_short"]


def test_unreachable_group_is_dropped():
    matrix = [[0, 5, None], [5, 0, None], [None, None, 0]]
    result = run(matrix, [officer("o1")], [group("ok", 1, (9 * H, 16 * H)), group("island", 2, (9 * H, 16 * H))])
    assert result.dropped == ["island"]


def test_unused_matrix_nodes_are_ignored():
    # Node 1 is the start of an officer who is not in the request; nobody should visit it.
    result = run(line_matrix([0, 3, 10]), [officer("o1", 0)], [group("g", 2, (9 * H, 16 * H))])
    assert stops_of(result, "o1") == ["g"]


def load_sample(name: str) -> OptimizeRequest:
    data = json.loads((Path(__file__).parent / name).read_text())
    return OptimizeRequest(**{**data, "time_limit_sec": 2})


def test_sample_request_solves_within_time_limit():
    """The real Monday data used for the manual API test (sample_request.json)."""
    request = load_sample("sample_request.json")
    result = solve(request)
    assert_timeline_is_valid(request, result)
    assert result.status in ("optimal", "partial")
    assert result.solve_time_sec < 2 + 1


def test_sample_with_one_officer_drops_low_priority_first():
    """8 Monday meetings, 1 officer with max 5 → the 3 dropped are the low-priority ones."""
    request = load_sample("sample_request_one_officer.json")
    result = solve(request)
    assert_timeline_is_valid(request, result)
    penalty = {g.id: g.penalty for g in request.groups}
    assert result.status == "partial"
    assert sorted(penalty[g] for g in result.dropped) == [50, 50, 50]
