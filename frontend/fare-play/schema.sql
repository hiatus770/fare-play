-- ============================================
-- BUS PREDICTION MARKET - COMPLETE SCHEMA
-- ============================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- TABLES
-- ============================================

-- Users table (synced with auth.users)
CREATE TABLE public.users (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT UNIQUE NOT NULL,
    username TEXT UNIQUE NOT NULL,
    balance DECIMAL(10, 2) DEFAULT 0.00 NOT NULL CHECK (balance >= 0),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Bus routes
CREATE TABLE public.bus_routes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    route_number TEXT NOT NULL,
    route_name TEXT NOT NULL,
    operator TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    UNIQUE(route_number, operator)
);

-- Bus stops
CREATE TABLE public.bus_stops (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    route_id UUID NOT NULL REFERENCES public.bus_routes(id) ON DELETE CASCADE,
    stop_name TEXT NOT NULL,
    stop_code TEXT,
    latitude DECIMAL(10, 8) NOT NULL,
    longitude DECIMAL(11, 8) NOT NULL,
    sequence_order INT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    UNIQUE(route_id, sequence_order)
);

-- Scheduled arrivals
CREATE TABLE public.scheduled_arrivals (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    bus_stop_id UUID NOT NULL REFERENCES public.bus_stops(id) ON DELETE CASCADE,
    scheduled_time TIMESTAMP WITH TIME ZONE NOT NULL,
    actual_time TIMESTAMP WITH TIME ZONE,
    status TEXT DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'arrived', 'cancelled', 'no_show')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Predictions
CREATE TABLE public.predictions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    creator_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    scheduled_arrival_id UUID NOT NULL REFERENCES public.scheduled_arrivals(id) ON DELETE CASCADE,
    predicted_arrival_time TIMESTAMP WITH TIME ZONE NOT NULL,
    total_pool DECIMAL(10, 2) DEFAULT 0.00 NOT NULL,
    status TEXT DEFAULT 'open' CHECK (status IN ('open', 'closed', 'resolved', 'cancelled')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    resolved_at TIMESTAMP WITH TIME ZONE
);

-- Bets
CREATE TABLE public.bets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    prediction_id UUID NOT NULL REFERENCES public.predictions(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    amount DECIMAL(10, 2) NOT NULL CHECK (amount > 0),
    position TEXT NOT NULL CHECK (position IN ('early', 'on_time', 'late', 'very_late')),
    potential_payout DECIMAL(10, 2),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    UNIQUE(prediction_id, user_id, position)
);

-- Outcomes
CREATE TABLE public.outcomes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    prediction_id UUID UNIQUE NOT NULL REFERENCES public.predictions(id) ON DELETE CASCADE,
    actual_arrival_time TIMESTAMP WITH TIME ZONE NOT NULL,
    delay_minutes INT NOT NULL,
    resolved_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Transactions
CREATE TABLE public.transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    amount DECIMAL(10, 2) NOT NULL,
    transaction_type TEXT NOT NULL CHECK (transaction_type IN ('deposit', 'withdrawal', 'bet_placed', 'bet_won', 'bet_lost', 'refund')),
    reference_id UUID,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- ============================================
-- INDEXES
-- ============================================

CREATE INDEX idx_users_email ON public.users(email);
CREATE INDEX idx_users_username ON public.users(username);
CREATE INDEX idx_bus_stops_route_id ON public.bus_stops(route_id);
CREATE INDEX idx_scheduled_arrivals_bus_stop_id ON public.scheduled_arrivals(bus_stop_id);
CREATE INDEX idx_scheduled_arrivals_scheduled_time ON public.scheduled_arrivals(scheduled_time);
CREATE INDEX idx_predictions_creator_id ON public.predictions(creator_id);
CREATE INDEX idx_predictions_scheduled_arrival_id ON public.predictions(scheduled_arrival_id);
CREATE INDEX idx_predictions_status ON public.predictions(status);
CREATE INDEX idx_bets_prediction_id ON public.bets(prediction_id);
CREATE INDEX idx_bets_user_id ON public.bets(user_id);
CREATE INDEX idx_transactions_user_id ON public.transactions(user_id);
CREATE INDEX idx_transactions_created_at ON public.transactions(created_at);

-- ============================================
-- TRIGGERS
-- ============================================

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_users_updated_at
    BEFORE UPDATE ON public.users
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Handle new user creation from auth.users
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.users (id, email, username, balance, created_at)
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'username', SPLIT_PART(NEW.email, '@', 1)),
        0.00,
        NOW()
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_user();

-- ============================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================

-- Enable RLS on all tables
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bus_routes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bus_stops ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scheduled_arrivals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.predictions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.outcomes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;

-- Users: Can read all, update only their own
CREATE POLICY "Users can view all profiles" ON public.users
    FOR SELECT USING (true);

CREATE POLICY "Users can update own profile" ON public.users
    FOR UPDATE USING (auth.uid() = id);

-- Bus routes, stops, arrivals: Public read
CREATE POLICY "Anyone can view bus routes" ON public.bus_routes
    FOR SELECT USING (true);

CREATE POLICY "Anyone can view bus stops" ON public.bus_stops
    FOR SELECT USING (true);

CREATE POLICY "Anyone can view scheduled arrivals" ON public.scheduled_arrivals
    FOR SELECT USING (true);

-- Predictions: Public read, authenticated create
CREATE POLICY "Anyone can view predictions" ON public.predictions
    FOR SELECT USING (true);

CREATE POLICY "Authenticated users can create predictions" ON public.predictions
    FOR INSERT WITH CHECK (auth.uid() = creator_id);

-- Bets: Users can view all, create their own
CREATE POLICY "Anyone can view bets" ON public.bets
    FOR SELECT USING (true);

CREATE POLICY "Authenticated users can create bets" ON public.bets
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Outcomes: Public read
CREATE POLICY "Anyone can view outcomes" ON public.outcomes
    FOR SELECT USING (true);

-- Transactions: Users can only see their own
CREATE POLICY "Users can view own transactions" ON public.transactions
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create own transactions" ON public.transactions
    FOR INSERT WITH CHECK (auth.uid() = user_id);