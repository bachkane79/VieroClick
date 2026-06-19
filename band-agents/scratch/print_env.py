import os

print("=== Environment Variables ===")
for k, v in os.environ.items():
    if any(x in k.lower() for x in ["api", "key", "url", "token", "pass", "secret"]):
        # Mask sensitive info
        masked = v[:10] + "..." if len(v) > 10 else v
        print(f"{k}: {masked}")
    else:
        print(f"{k}: {v}")
