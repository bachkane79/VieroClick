import psycopg2

db_url = "postgresql://neondb_owner:npg_mbDRG8HwArK0@ep-bitter-band-ao59rq56-pooler.c-2.ap-southeast-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require"

def main():
    conn = psycopg2.connect(db_url)
    cur = conn.cursor()
    
    # 1. Fetch Users
    cur.execute("SELECT id, email, full_name, avatar_url, created_at FROM users;")
    users = cur.fetchall()
    print("=== USERS ===")
    for row in users:
        print(f"ID: {row[0]}\nEmail: {row[1]}\nName: {row[2]}\nAvatar: {row[3]}\nCreated: {row[4]}\n" + "-"*40)
        
    # 2. Fetch Workspaces
    cur.execute("SELECT id, name, slug, owner_id FROM workspaces;")
    workspaces = cur.fetchall()
    print("\n=== WORKSPACES ===")
    for row in workspaces:
        print(f"ID: {row[0]}\nName: {row[1]}\nSlug: {row[2]}\nOwner ID: {row[3]}\n" + "-"*40)
        
    # 3. Fetch Workspace Members with User info
    cur.execute("""
        SELECT wm.id, wm.workspace_id, wm.role, wm.title, u.email, u.full_name
        FROM workspace_members wm
        JOIN users u ON wm.user_id = u.id;
    """)
    members = cur.fetchall()
    print("\n=== WORKSPACE MEMBERS ===")
    for row in members:
        print(f"Member ID: {row[0]}\nWorkspace ID: {row[1]}\nRole: {row[2]}\nTitle: {row[3]}\nUser Email: {row[4]}\nUser Name: {row[5]}\n" + "-"*40)

    cur.close()
    conn.close()

if __name__ == "__main__":
    main()
