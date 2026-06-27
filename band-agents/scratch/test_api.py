import httpx
import os
from dotenv import load_dotenv

# Load env variables from band-agents folder
load_dotenv()

BASE_URL = "http://localhost:3000"
TOKEN = os.getenv("VIEROC_API_TOKEN")

headers = {
    "Content-Type": "application/json",
    "Authorization": f"Bearer {TOKEN}"
}

def run_tests():
    print("=== STARTING API VERIFICATION TESTS ===")
    
    # 1. Test /api/health
    print("\n1. Testing GET /api/health...")
    resp = httpx.get(f"{BASE_URL}/api/health")
    print(f"Status Code: {resp.status_code}")
    print(f"Response: {resp.text}")
    assert resp.status_code == 200, "Health check failed!"
    
    # 2. Get projects and members from /api/test-db
    print("\n2. Fetching project & member context from /api/test-db...")
    resp = httpx.get(f"{BASE_URL}/api/test-db")
    print(f"Status Code: {resp.status_code}")
    if resp.status_code != 200:
        print(f"Failed: {resp.text}")
        return
        
    data = resp.json()
    projects = data.get("projects", [])
    members = data.get("members", [])
    
    if not projects:
        print("ERROR: No projects found in DB! Cannot test task creation.")
        return
    if not members:
        print("ERROR: No members found in DB! Cannot test task assignment.")
        return
        
    project_id = projects[0]["id"]
    project_name = projects[0]["name"]
    member_id = members[0]["id"]
    
    print(f"Found project '{project_name}' with ID: {project_id}")
    print(f"Found workspace member with ID: {member_id}")
    
    # 3. Test /api/tasks (POST)
    print("\n3. Testing POST /api/tasks (Create Task)...")
    task_payload = {
        "title": "Hackathon API Verification Task",
        "description": "Created by the verification script to verify /api/tasks endpoint.",
        "projectId": project_id,
        "priority": "HIGH",
        "estimatedHours": 8.0
    }
    resp = httpx.post(f"{BASE_URL}/api/tasks", json=task_payload, headers=headers)
    print(f"Status Code: {resp.status_code}")
    print(f"Response: {resp.text}")
    assert resp.status_code == 201, "Task creation failed!"
    task_data = resp.json()
    task_id = task_data.get("id")
    print(f"Successfully created task with ID: {task_id}")
    
    # 4. Test /api/tasks/assign (POST)
    print("\n4. Testing POST /api/tasks/assign (Assign Task)...")
    assign_payload = {
        "taskId": task_id,
        "memberId": member_id
    }
    resp = httpx.post(f"{BASE_URL}/api/tasks/assign", json=assign_payload, headers=headers)
    print(f"Status Code: {resp.status_code}")
    print(f"Response: {resp.text}")
    assert resp.status_code == 200, "Task assignment failed!"
    
    # 5. Test /api/comments (POST)
    print("\n5. Testing POST /api/comments (Add Comment)...")
    comment_payload = {
        "taskId": task_id,
        "content": "API Verification script: all endpoints work perfectly! Notifier agent is fully ready to sync."
    }
    resp = httpx.post(f"{BASE_URL}/api/comments", json=comment_payload, headers=headers)
    print(f"Status Code: {resp.status_code}")
    print(f"Response: {resp.text}")
    assert resp.status_code == 201, "Comment creation failed!"
    
    print("\n=== ALL REST API ENDPOINTS TESTED AND VERIFIED SUCCESSFULLY! ===")

if __name__ == "__main__":
    run_tests()
