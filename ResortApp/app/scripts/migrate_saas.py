import sys
import os
import json
from datetime import datetime, timezone, timedelta

# Ensure app is in pythonpath
sys.path.append(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from sqlalchemy import text
from app.database import engine, SessionLocal, Base
from app.models.tenant import SaaSPlan, Tenant

def run_migration():
    print("=== Starting SaaS Multi-Tenant Migration ===")
    
    # 0. Ensure core model tables exist before running alters
    from app.models.tenant import SaaSPlan, Tenant
    from app.models.branch import Branch
    from app.models.user import User, Role
    from app.models.room import Room
    from app.models.booking import Booking
    Base.metadata.create_all(bind=engine)
    
    with engine.begin() as conn:
        # 1. Create saas_plans table
        conn.execute(text("""
            CREATE TABLE IF NOT EXISTS saas_plans (
                id SERIAL PRIMARY KEY,
                name VARCHAR NOT NULL,
                code VARCHAR UNIQUE NOT NULL,
                price_monthly FLOAT DEFAULT 0.0,
                price_yearly FLOAT DEFAULT 0.0,
                max_branches INTEGER DEFAULT 1,
                max_rooms INTEGER DEFAULT 15,
                max_staff_users INTEGER DEFAULT 5,
                description VARCHAR,
                badge VARCHAR,
                features TEXT,
                is_active BOOLEAN DEFAULT TRUE NOT NULL,
                created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP
            );
            CREATE INDEX IF NOT EXISTS ix_saas_plans_id ON saas_plans (id);
            CREATE INDEX IF NOT EXISTS ix_saas_plans_code ON saas_plans (code);
            ALTER TABLE saas_plans ADD COLUMN IF NOT EXISTS description VARCHAR;
            ALTER TABLE saas_plans ADD COLUMN IF NOT EXISTS badge VARCHAR;
        """))
        print("[OK] saas_plans table verified/created.")

        # 2. Create tenants table
        conn.execute(text("""
            CREATE TABLE IF NOT EXISTS tenants (
                id SERIAL PRIMARY KEY,
                name VARCHAR NOT NULL,
                slug VARCHAR UNIQUE NOT NULL,
                custom_domain VARCHAR UNIQUE,
                contact_email VARCHAR NOT NULL,
                contact_phone VARCHAR,
                country VARCHAR DEFAULT 'IN',
                currency VARCHAR DEFAULT 'INR' NOT NULL,
                timezone VARCHAR DEFAULT 'Asia/Kolkata' NOT NULL,
                logo_url VARCHAR,
                primary_color VARCHAR DEFAULT '#8bc34a',
                plan_id INTEGER REFERENCES saas_plans(id) ON DELETE SET NULL,
                subscription_status VARCHAR DEFAULT 'trialing' NOT NULL,
                trial_ends_at TIMESTAMP WITHOUT TIME ZONE,
                subscription_renews_at TIMESTAMP WITHOUT TIME ZONE,
                is_active BOOLEAN DEFAULT TRUE NOT NULL,
                created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
            );
            CREATE INDEX IF NOT EXISTS ix_tenants_id ON tenants (id);
            CREATE INDEX IF NOT EXISTS ix_tenants_slug ON tenants (slug);
            CREATE INDEX IF NOT EXISTS ix_tenants_custom_domain ON tenants (custom_domain);
        """))
        print("[OK] tenants table verified/created.")

        # 3. Add tenant_id to branches table
        conn.execute(text("""
            DO $$
            BEGIN
                IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='branches') THEN
                    IF NOT EXISTS (
                        SELECT 1 FROM information_schema.columns 
                        WHERE table_name='branches' AND column_name='tenant_id'
                    ) THEN
                        ALTER TABLE branches ADD COLUMN tenant_id INTEGER REFERENCES tenants(id) ON DELETE CASCADE;
                        CREATE INDEX IF NOT EXISTS ix_branches_tenant_id ON branches (tenant_id);
                    END IF;
                END IF;
            END $$;
        """))
        print("[OK] branches.tenant_id column verified/added.")

        # 4. Add tenant_id to users table
        conn.execute(text("""
            DO $$
            BEGIN
                IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='users') THEN
                    IF NOT EXISTS (
                        SELECT 1 FROM information_schema.columns 
                        WHERE table_name='users' AND column_name='tenant_id'
                    ) THEN
                        ALTER TABLE users ADD COLUMN tenant_id INTEGER REFERENCES tenants(id) ON DELETE CASCADE;
                        CREATE INDEX IF NOT EXISTS ix_users_tenant_id ON users (tenant_id);
                    END IF;
                END IF;
            END $$;
        """))
        print("[OK] users.tenant_id column verified/added.")

    # Seed Default Plans and Tenant 1
    db = SessionLocal()
    try:
        # Check plans
        plans_data = [
            {
                "name": "14-Day Free Trial",
                "code": "trial",
                "price_monthly": 0.0,
                "price_yearly": 0.0,
                "max_branches": 1,
                "max_rooms": 20,
                "max_staff_users": 10,
                "description": "Full access to test all core hospitality features.",
                "badge": "Trial",
                "features": json.dumps(["dashboard", "room_management", "booking_engine", "qr_menu", "staff_management", "guest_portal"])
            },
            {
                "name": "Starter",
                "code": "starter",
                "price_monthly": 2999.0, # in INR / $39
                "price_yearly": 29990.0,
                "max_branches": 1,
                "max_rooms": 25,
                "max_staff_users": 10,
                "description": "Ideal for boutique resorts, homestays, and bed & breakfasts.",
                "badge": "Starter",
                "features": json.dumps(["dashboard", "room_management", "booking_engine", "qr_menu", "staff_management", "guest_portal", "basic_reports"])
            },
            {
                "name": "Growth Pro",
                "code": "growth",
                "price_monthly": 6999.0, # in INR / $89
                "price_yearly": 69990.0,
                "max_branches": 3,
                "max_rooms": 75,
                "max_staff_users": 30,
                "description": "For growing resorts and hotels requiring multi-branch and POS.",
                "badge": "Most Popular",
                "features": json.dumps(["dashboard", "room_management", "booking_engine", "qr_menu", "staff_management", "guest_portal", "pos", "inventory", "comprehensive_reports", "channel_manager"])
            },
            {
                "name": "Enterprise Chain",
                "code": "enterprise",
                "price_monthly": 14999.0,
                "price_yearly": 149990.0,
                "max_branches": 999,
                "max_rooms": 9999,
                "max_staff_users": 9999,
                "description": "For hotel chains with custom domain, accounting, and priority support.",
                "badge": "Enterprise",
                "features": json.dumps(["dashboard", "room_management", "booking_engine", "qr_menu", "staff_management", "guest_portal", "pos", "inventory", "comprehensive_reports", "channel_manager", "accounting", "custom_domain", "dedicated_support"])
            }
        ]

        for p_data in plans_data:
            existing = db.query(SaaSPlan).filter(SaaSPlan.code == p_data["code"]).first()
            if not existing:
                plan = SaaSPlan(**p_data)
                db.add(plan)
                db.commit()
                print(f"[OK] Seeded SaaS Plan: {p_data['name']}")
            else:
                # Update description and badge if missing
                if not existing.description or not existing.badge:
                    existing.description = p_data.get("description")
                    existing.badge = p_data.get("badge")
                    db.commit()
                    print(f"[OK] Updated SaaS Plan metadata: {p_data['name']}")

        # Ensure default Tenant 1 for existing data
        trial_plan = db.query(SaaSPlan).filter(SaaSPlan.code == "trial").first()
        existing_tenant = db.query(Tenant).filter(Tenant.slug == "stayone").first()
        if not existing_tenant:
            tenant_1 = Tenant(
                name="Stayone Hospitality",
                slug="stayone",
                contact_email="info@stayone.com",
                contact_phone="+918075019543",
                currency="INR",
                timezone="Asia/Kolkata",
                plan_id=trial_plan.id if trial_plan else None,
                subscription_status="active",
                trial_ends_at=datetime.now(timezone.utc) + timedelta(days=365),
                is_active=True
            )
            db.add(tenant_1)
            db.commit()
            db.refresh(tenant_1)
            tenant_1_id = tenant_1.id
            print(f"[OK] Created Primary Default Tenant: Stayone Hospitality (ID: {tenant_1_id})")
        else:
            tenant_1_id = existing_tenant.id
            print(f"[OK] Primary Tenant already exists (ID: {tenant_1_id})")

        # Backfill existing branches & users with tenant_id = tenant_1_id if NULL
        db.execute(text(f"UPDATE branches SET tenant_id = {tenant_1_id} WHERE tenant_id IS NULL"))
        db.execute(text(f"UPDATE users SET tenant_id = {tenant_1_id} WHERE tenant_id IS NULL"))
        db.commit()
        print(f"[OK] Existing branches and users linked to Tenant ID {tenant_1_id}.")

    finally:
        db.close()

    print("=== SaaS Multi-Tenant Migration Completed Successfully ===")

if __name__ == "__main__":
    run_migration()
