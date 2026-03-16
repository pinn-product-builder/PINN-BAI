INSERT INTO user_roles (user_id, role)
VALUES ('d3accdfe-7759-4c67-a301-b10b90b53f99', 'platform_admin')
ON CONFLICT (user_id, role) DO NOTHING;