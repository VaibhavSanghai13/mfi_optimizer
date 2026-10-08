"""Input/output contract of POST /api/optimize.

The TypeScript side (lib/plans.ts, S9) builds the request from the database and the
travel matrix, and turns the response back into a Plan. All times are MINUTES FROM
MIDNIGHT (09:30 → 570); all durations are minutes.

Matrix layout: `time_matrix[i][j]` is the two-wheeler travel time from node i to
node j. Every officer's start location and every group is one node; `node` fields
point into the matrix. `None` means there is no road route between the two points.
"""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field, model_validator

Minutes = int


class OfficerIn(BaseModel):
    id: str
    node: int = Field(ge=0, description="Matrix index of the officer's start (and end) location.")
    shift_start: Minutes = Field(ge=0, le=24 * 60)
    shift_end: Minutes = Field(ge=0, le=24 * 60)
    break_start: Minutes = Field(ge=0, le=24 * 60)
    break_duration: Minutes = Field(ge=0, le=180)
    max_meetings: int = Field(ge=1)


class GroupIn(BaseModel):
    id: str
    node: int = Field(ge=0)
    window_start: Minutes = Field(ge=0, le=24 * 60)
    window_end: Minutes = Field(ge=0, le=24 * 60)
    duration: Minutes = Field(ge=1, le=240)
    penalty: int = Field(ge=0, description="Cost of NOT visiting this group (from its priority).")
    officer_id: str | None = Field(default=None, description="Only this officer may visit it.")


class OptimizeRequest(BaseModel):
    time_matrix: list[list[int | None]]
    officers: list[OfficerIn] = Field(min_length=1)
    groups: list[GroupIn] = Field(min_length=1)
    buffer_min: Minutes = Field(default=0, ge=0, le=60)
    allow_late_arrival: bool = False
    balance_workload: bool = False
    time_limit_sec: float = Field(default=10, gt=0, le=60)

    @model_validator(mode="after")
    def check_matrix(self) -> OptimizeRequest:
        size = len(self.time_matrix)
        if any(len(row) != size for row in self.time_matrix):
            raise ValueError("time_matrix must be square")
        for item in [*self.officers, *self.groups]:
            if item.node >= size:
                raise ValueError(f"node {item.node} of {item.id} is outside the time_matrix")
        if len({g.node for g in self.groups}) != len(self.groups):
            raise ValueError("every group needs its own node")
        return self


class StopOut(BaseModel):
    group_id: str
    arrival: Minutes
    wait: Minutes
    start: Minutes
    end: Minutes
    departure: Minutes
    travel_from_prev: Minutes


class RouteOut(BaseModel):
    officer_id: str
    start: Minutes = Field(description="Leaves the start location.")
    end: Minutes = Field(description="Back at the start location.")
    stops: list[StopOut]
    return_travel: Minutes
    break_start: Minutes | None = Field(description="None when the route is over before lunch.")
    break_end: Minutes | None
    total_travel: Minutes
    total_wait: Minutes
    total_meeting: Minutes


class OptimizeResponse(BaseModel):
    status: Literal["optimal", "partial", "infeasible"]
    solver_status: str
    solve_time_sec: float
    routes: list[RouteOut]
    dropped: list[str] = Field(description="Ids of groups that could not be scheduled.")
