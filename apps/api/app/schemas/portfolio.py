import math

from pydantic import BaseModel, Field, model_validator


class PortfolioPosition(BaseModel):
    symbol: str
    weight: float = Field(ge=0.0, le=1.0)


class Portfolio(BaseModel):
    id: str
    name: str
    currency: str = "USD"
    total_value: float = Field(gt=0.0)
    positions: list[PortfolioPosition]

    @model_validator(mode="after")
    def _weights_sum_to_one(self) -> "Portfolio":
        total = sum(p.weight for p in self.positions)
        if not math.isclose(total, 1.0, abs_tol=0.01):
            raise ValueError(
                f"Portfolio position weights must sum to ~1.0, got {total:.4f}"
            )
        return self
