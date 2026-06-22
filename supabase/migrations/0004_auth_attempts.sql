-- AUTH ATTEMPTS
CREATE TABLE auth_attempts (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    email TEXT NOT NULL,
    attempts INTEGER DEFAULT 1,
    last_attempt TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    locked_until TIMESTAMP WITH TIME ZONE
);

CREATE INDEX idx_auth_attempts_email ON auth_attempts(email);
