from sqlalchemy.orm import Session
from app.models.branch import Branch
from typing import List, Optional

def get_branches(db: Session, skip: int = 0, limit: int = 100, include_inactive: bool = False) -> List[Branch]:
    query = db.query(Branch)
    if not include_inactive:
        query = query.filter(Branch.is_active == True)
    return query.offset(skip).limit(limit).all()

def get_branch_by_id(db: Session, branch_id: int) -> Optional[Branch]:
    return db.query(Branch).filter(Branch.id == branch_id).first()

def get_branch_by_code(db: Session, code: str) -> Optional[Branch]:
    return db.query(Branch).filter(Branch.code == code).first()

def create_branch(db: Session, name: str, code: str, address: str = None, phone: str = None, email: str = None, gst_number: str = None, image_url: str = None, facebook: str = None, instagram: str = None, twitter: str = None, linkedin: str = None, location: str = None, tenant_id: int = None, is_active: bool = True) -> Branch:
    db_branch = Branch(
        name=name,
        code=code,
        address=address,
        phone=phone,
        email=email,
        gst_number=gst_number,
        image_url=image_url,
        facebook=facebook,
        instagram=instagram,
        twitter=twitter,
        linkedin=linkedin,
        location=location,
        tenant_id=tenant_id,
        is_active=is_active
    )
    db.add(db_branch)
    db.commit()
    db.refresh(db_branch)
    return db_branch

def update_branch(db: Session, branch_id: int, **kwargs) -> Optional[Branch]:
    db_branch = get_branch_by_id(db, branch_id)
    if db_branch:
        for key, value in kwargs.items():
            if hasattr(db_branch, key):
                setattr(db_branch, key, value)
        db.commit()
        db.refresh(db_branch)
    return db_branch

def delete_branch(db: Session, branch_id: int) -> bool:
    db_branch = get_branch_by_id(db, branch_id)
    if db_branch:
        db_branch.is_active = False
        db.commit()
        return True
    return False
