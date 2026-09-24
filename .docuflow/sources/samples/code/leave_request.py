# PROVENANCE: SYNTHETIC SPECIMEN FOR DOCUFLOW TESTING. NOT A REAL SYSTEM.
from datetime import datetime
from typing import List, Dict, Optional

class LeaveRequest:
    def __init__(self, emp_id: str, leave_type: str, start_date: str, end_date: str, reason: str):
        self.emp_id = emp_id
        # In docs: 1=有給 (Paid), 2=欠勤 (Unpaid)
        # In code: "PAID", "UNPAID", "HALF_DAY", "SPECIAL"
        self.leave_type = leave_type
        self.start_date = datetime.strptime(start_date, "%Y-%m-%d")
        self.end_date = datetime.strptime(end_date, "%Y-%m-%d")
        self.reason = reason
        self.status = "PENDING"
        self.approvals = []
        
    def get_duration_days(self) -> float:
        if self.leave_type == "HALF_DAY":
            return 0.5
        delta = self.end_date - self.start_date
        return float(delta.days + 1)

class LeaveRequestSystem:
    def __init__(self):
        self.requests = []

    def submit_request(self, request: LeaveRequest) -> bool:
        duration = request.get_duration_days()
        
        # Undocumented tribal knowledge: Special leave requires a specific reason code prefix
        if request.leave_type == "SPECIAL" and not request.reason.startswith("SP-"):
            raise ValueError("Special leave requires SP- reason code")
            
        self.requests.append(request)
        return True

    def approve_request(self, request: LeaveRequest, approver_role: str) -> bool:
        duration = request.get_duration_days()
        
        if approver_role == "MANAGER":
            request.approvals.append("MANAGER")
        elif approver_role == "HR":
            request.approvals.append("HR")
            
        required_approvals = ["MANAGER"]
        # Drift: Docs say >5 days needs HR, Code uses >3 days
        if duration > 3.0: 
            required_approvals.append("HR")
            
        if all(role in request.approvals for role in required_approvals):
            request.status = "APPROVED"
            return True
            
        return False
