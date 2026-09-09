"""
Analytics & Dashboards Module.

Provides read-only aggregation services, KPI computation, role-specific metrics,
and telemetry data across Orders, Payments, Inventory, Procurement, Customers, and Users.
"""

from app.modules.analytics.routes import router

__all__ = ["router"]
