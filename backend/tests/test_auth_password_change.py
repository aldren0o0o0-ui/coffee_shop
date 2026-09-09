import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.database.session import SessionLocal
from app.modules.users.models import Role, User, UserRole
from app.core.security import hash_password

client = TestClient(app)

def test_password_change_flow():
    db = SessionLocal()
    test_username = "test_staff_user"
    test_email = "test_staff@brewflow.local"
    temp_pass = "TempPassword123!"
    new_pass = "NewSecurePassword456!"

    user = db.query(User).filter(User.username == test_username).first()
    if user:
        user.password_hash = hash_password(temp_pass)
        user.must_change_password = True
        db.commit()
    else:
        role = db.query(Role).filter(Role.role_name == "Cashier").first()
        if not role:
            role = Role(role_name="Cashier", description="Cashier Role", is_active=True)
            db.add(role)
            db.flush()
        
        user = User(
            username=test_username,
            email=test_email,
            password_hash=hash_password(temp_pass),
            first_name="Test",
            last_name="Staff",
            must_change_password=True,
            is_active=True,
        )
        db.add(user)
        db.flush()
        db.add(UserRole(user_id=user.user_id, role_id=role.role_id, is_active=True))
        db.commit()
    db.close()

    # Step 1: Login with temporary password
    login_res = client.post("/api/v1/auth/login", json={
        "identifier": test_username,
        "password": temp_pass,
    })
    assert login_res.status_code == 200, login_res.text
    user_data = login_res.json()
    assert user_data["must_change_password"] is True

    # Step 2: Try to change password with wrong current password
    fail_res1 = client.post("/api/v1/auth/change-password", json={
        "current_password": "WrongPassword999!",
        "new_password": new_pass,
        "confirm_password": new_pass,
    })
    assert fail_res1.status_code == 400
    assert "current password was incorrect" in fail_res1.json()["detail"].lower()

    # Step 3: Try to change password with same password
    fail_res2 = client.post("/api/v1/auth/change-password", json={
        "current_password": temp_pass,
        "new_password": temp_pass,
        "confirm_password": temp_pass,
    })
    assert fail_res2.status_code == 400
    assert "same as your current password" in fail_res2.json()["detail"].lower()

    # Step 4: Try to change with mismatched confirmation
    fail_res3 = client.post("/api/v1/auth/change-password", json={
        "current_password": temp_pass,
        "new_password": new_pass,
        "confirm_password": "DifferentConfirmation789!",
    })
    assert fail_res3.status_code == 422

    # Step 5: Successful password change
    success_res = client.post("/api/v1/auth/change-password", json={
        "current_password": temp_pass,
        "new_password": new_pass,
        "confirm_password": new_pass,
    })
    assert success_res.status_code == 200, success_res.text
    updated_user = success_res.json()
    assert updated_user["must_change_password"] is False

    # Step 6: Logout and log back in with new password
    logout_res = client.post("/api/v1/auth/logout")
    assert logout_res.status_code == 200

    # Old password should fail
    old_login_res = client.post("/api/v1/auth/login", json={
        "identifier": test_username,
        "password": temp_pass,
    })
    assert old_login_res.status_code == 401

    # New password should succeed
    new_login_res = client.post("/api/v1/auth/login", json={
        "identifier": test_username,
        "password": new_pass,
    })
    assert new_login_res.status_code == 200
    assert new_login_res.json()["must_change_password"] is False
    print("ALL AUTH & PASSWORD CHANGE TESTS PASSED SUCCESSFULLY!")

if __name__ == "__main__":
    test_password_change_flow()
