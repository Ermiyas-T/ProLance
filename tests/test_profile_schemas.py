from datetime import datetime
from decimal import Decimal

from app.schemas.profile import (
    ClientProfileCreate,
    ClientProfileOut,
    ClientProfileUpdate,
    FreelancerProfileCreate,
    FreelancerProfileOut,
    FreelancerProfileUpdate,
    PortfolioItemCreate,
    PortfolioItemOut,
    SkillOut,
)


# test that all profile schemas can be instantiated and validated properly
def test_client_profile_schemas():
    # construct input payload for client profile creation
    create_data = ClientProfileCreate(
        display_name="Acme Corp",
        bio="We build great products",
        location="New York, NY",
        avatar_url="https://example.com/avatar.png",
    )
    assert create_data.display_name == "Acme Corp"

    # construct output schema for client profile
    now = datetime.now()
    out_data = ClientProfileOut(
        id=1,
        user_id=10,
        display_name=create_data.display_name,
        bio=create_data.bio,
        location=create_data.location,
        avatar_url=create_data.avatar_url,
        created_at=now,
        updated_at=now,
    )
    assert out_data.id == 1
    assert out_data.user_id == 10


# test freelancer profile schemas including monetary precision and nested models
def test_freelancer_profile_schemas():
    # construct nested skill response model
    skill = SkillOut(id=1, name="Python")
    assert skill.name == "Python"

    # construct nested portfolio item response model
    portfolio_item = PortfolioItemOut(
        id=100,
        freelancer_profile_id=2,
        title="E-commerce App",
        description="Built with FastAPI",
        url="https://github.com/example/repo",
        created_at=datetime.now(),
    )
    assert portfolio_item.title == "E-commerce App"

    # construct input payload for freelancer profile creation
    create_data = FreelancerProfileCreate(
        professional_title="Full Stack Engineer",
        bio="Passionate Python dev",
        hourly_rate=Decimal("75.50"),
        skills=["Python", "FastAPI"],
    )
    assert create_data.hourly_rate == Decimal("75.50")

    # construct output schema for freelancer profile
    now = datetime.now()
    out_data = FreelancerProfileOut(
        id=2,
        user_id=20,
        professional_title=create_data.professional_title,
        bio=create_data.bio,
        hourly_rate=create_data.hourly_rate,
        skills=[skill],
        portfolio_items=[portfolio_item],
        created_at=now,
        updated_at=now,
    )
    assert out_data.id == 2
    # assert running average rating default
    assert out_data.avg_rating == Decimal("0.00")
    # assert completed projects count default
    assert out_data.completed_projects_count == 0
    assert len(out_data.skills) == 1
    assert len(out_data.portfolio_items) == 1
