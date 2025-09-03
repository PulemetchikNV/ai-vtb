from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routers.resumes import router as resumes_router
from app.routers.documents import router as documents_router


def create_app() -> FastAPI:
    app = FastAPI(title="HR Analyzer Service", version="0.1.0")

    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    app.include_router(resumes_router, prefix="/api/resumes", tags=["resumes"])
    app.include_router(documents_router, prefix="/api", tags=["documents"])
    return app


app = create_app()

