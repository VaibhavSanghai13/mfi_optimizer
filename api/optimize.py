"""Python serverless function served at /api/optimize.

On Vercel this file becomes its own function; locally `npm run dev` runs it with uvicorn
on port 8000 and Next.js forwards /api/optimize/* to it. Routes use the full
/api/optimize path because Vercel passes the original request path through.

It never touches the database: the TypeScript side sends everything the solver needs
(lib/plans.ts, S9), together with the user's session JWT.
"""

import os

import jwt
from fastapi import Depends, FastAPI, Header, HTTPException

from optimizer import ortools_version
from optimizer.model import solve
from optimizer.schemas import OptimizeRequest, OptimizeResponse

app = FastAPI(title="MFI Route Optimizer — optimizer function")


def require_manager(authorization: str | None = Header(default=None)) -> dict:
    """Checks `Authorization: Bearer <JWT>` — the same session token Next.js issues (HS256, JWT_SECRET)."""
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Please sign in.")
    secret = os.environ.get("JWT_SECRET")
    if not secret:
        raise HTTPException(status_code=500, detail="JWT_SECRET is not configured.")
    try:
        claims = jwt.decode(authorization.removeprefix("Bearer "), secret, algorithms=["HS256"])
    except jwt.InvalidTokenError:  # bad signature, expired, malformed …
        raise HTTPException(status_code=401, detail="Please sign in again.")
    if claims.get("role") != "manager":
        raise HTTPException(status_code=403, detail="You do not have access to this.")
    return claims


@app.get("/api/optimize/health")
def health() -> dict[str, str]:
    return {"status": "ok", "ortools": ortools_version()}


@app.post("/api/optimize", response_model=OptimizeResponse)
def optimize(request: OptimizeRequest, _claims: dict = Depends(require_manager)) -> OptimizeResponse:
    return solve(request)
