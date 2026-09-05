from fastapi import Depends, FastAPI, status
from fastapi.responses import JSONResponse
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.routers import auth, profiles, projects, proposals

app = FastAPI(
    title="ProLance API",
    description="Freelancer marketplace backend",
    version="0.1.0",
)

# include application sub-routers
app.include_router(auth.router)
app.include_router(profiles.router)
app.include_router(profiles.skills_router)
app.include_router(projects.router)
app.include_router(proposals.router)


# comprehensive health check endpoint verifying app and database availability
@app.get("/health", tags=["health"])
def health(db: Session = Depends(get_db)):
    try:
        # execute lightweight query to confirm database connection is alive
        db.execute(text("SELECT 1"))
        return {"status": "ok", "database": "connected"}
    except Exception as exc:
        # return 503 service unavailable if database connection fails
        return JSONResponse(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            content={"status": "degraded", "database": "unreachable", "detail": str(exc)},
        )
