from datetime import datetime

from pydantic import BaseModel

from app.models.install_details import InstallDifficulty, InstallLocation


class InstallDetailsCreate(BaseModel):
    install_location: InstallLocation | None = None
    install_difficulty: InstallDifficulty | None = None
    install_start_date: datetime | None = None
    install_end_date: datetime | None = None


class InstallDetailsResponse(InstallDetailsCreate):
    model_config = {"from_attributes": True}
