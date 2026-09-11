from fastapi import APIRouter, HTTPException, status
from app.modules.auth.dependencies import CurrentAuthenticationDependency
from app.modules.shifts.schemas import CashMovementRequest, CloseShiftRequest, OpenShiftRequest, ShiftResponse
from app.modules.shifts.service import add_cash_movement, approve_variance, close_shift, get_open_shift, list_pending_variances, open_shift
from app.shared.dependencies import DatabaseDependency
router = APIRouter(prefix="/shifts", tags=["Shifts & Cash"])
def allowed(user):
    return any(r.is_active and r.role.is_active and r.role.role_name.lower() in {"owner","manager","cashier"} for r in user.user_roles)
def manager_allowed(user):
    return any(r.is_active and r.role.is_active and r.role.role_name.lower() in {"owner","manager"} for r in user.user_roles)
@router.get("/current", response_model=ShiftResponse | None)
def current(authentication: CurrentAuthenticationDependency, database: DatabaseDependency):
    if not allowed(authentication.user): raise HTTPException(status_code=403, detail="Shift access denied.")
    return get_open_shift(database)
@router.post("/open", response_model=ShiftResponse, status_code=status.HTTP_201_CREATED)
def open_route(payload: OpenShiftRequest, authentication: CurrentAuthenticationDependency, database: DatabaseDependency):
    if not allowed(authentication.user): raise HTTPException(status_code=403, detail="Shift access denied.")
    return open_shift(database, authentication.user.user_id, payload.opening_cash, payload.notes)
@router.post("/{shift_id}/movements", status_code=status.HTTP_201_CREATED)
def movement_route(shift_id: int, payload: CashMovementRequest, authentication: CurrentAuthenticationDependency, database: DatabaseDependency):
    if not allowed(authentication.user): raise HTTPException(status_code=403, detail="Shift access denied.")
    shift = database.get(__import__('app.modules.shifts.models', fromlist=['Shift']).Shift, shift_id)
    if not shift: raise HTTPException(status_code=404, detail="Shift not found.")
    return add_cash_movement(database, shift, payload.movement_type, payload.amount, payload.reason, authentication.user.user_id)
@router.post("/{shift_id}/approve-variance", response_model=ShiftResponse)
def approve_variance_route(shift_id: int, authentication: CurrentAuthenticationDependency, database: DatabaseDependency):
    if not manager_allowed(authentication.user): raise HTTPException(status_code=403, detail="Manager approval required.")
    shift = database.get(__import__('app.modules.shifts.models', fromlist=['Shift']).Shift, shift_id)
    if not shift: raise HTTPException(status_code=404, detail="Shift not found.")
    return approve_variance(database, shift, authentication.user.user_id)
@router.get("/variance-reviews", response_model=list[ShiftResponse])
def variance_reviews(authentication: CurrentAuthenticationDependency, database: DatabaseDependency):
    if not manager_allowed(authentication.user): raise HTTPException(status_code=403, detail="Manager approval required.")
    return list_pending_variances(database)
@router.post("/{shift_id}/close", response_model=ShiftResponse)
def close_route(shift_id: int, payload: CloseShiftRequest, authentication: CurrentAuthenticationDependency, database: DatabaseDependency):
    if not allowed(authentication.user): raise HTTPException(status_code=403, detail="Shift access denied.")
    shift = database.get(__import__('app.modules.shifts.models', fromlist=['Shift']).Shift, shift_id)
    if not shift: raise HTTPException(status_code=404, detail="Shift not found.")
    return close_shift(database, shift, authentication.user.user_id, payload.counted_cash, payload.notes)
