CREATE EXTENSION IF NOT EXISTS "pg_cron" WITH SCHEMA "pg_catalog";
CREATE EXTENSION IF NOT EXISTS "pg_graphql" WITH SCHEMA "graphql";
CREATE EXTENSION IF NOT EXISTS "pg_net" WITH SCHEMA "public";
CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";
CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";
CREATE EXTENSION IF NOT EXISTS "plpgsql" WITH SCHEMA "pg_catalog";
CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";
CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";
BEGIN;

--
-- PostgreSQL database dump
--


-- Dumped from database version 17.6
-- Dumped by pg_dump version 18.1

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: public; Type: SCHEMA; Schema: -; Owner: -
--



--
-- Name: app_role; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.app_role AS ENUM (
    'admin',
    'moderator',
    'user'
);


--
-- Name: handle_new_user(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.handle_new_user() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  INSERT INTO public.profiles (user_id, email, display_name)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1)));
  RETURN NEW;
END;
$$;


--
-- Name: has_role(uuid, public.app_role); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.has_role(_user_id uuid, _role public.app_role) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;


--
-- Name: update_updated_at_column(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_updated_at_column() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


SET default_table_access_method = heap;

--
-- Name: chat_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.chat_logs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    ip_address text,
    conversation_id text,
    user_message text NOT NULL,
    message_count integer DEFAULT 1,
    user_agent text,
    is_voice boolean DEFAULT false,
    detail_mode text
);


--
-- Name: conversation_messages; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.conversation_messages (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    conversation_id text NOT NULL,
    role text NOT NULL,
    content text NOT NULL,
    tool_calls jsonb,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT conversation_messages_role_check CHECK ((role = ANY (ARRAY['user'::text, 'assistant'::text])))
);


--
-- Name: help_tickets; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.help_tickets (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    type text NOT NULL,
    subject text NOT NULL,
    description text NOT NULL,
    email text,
    priority text DEFAULT 'normal'::text,
    status text DEFAULT 'open'::text,
    user_agent text,
    page_url text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT help_tickets_priority_check CHECK ((priority = ANY (ARRAY['low'::text, 'normal'::text, 'high'::text, 'urgent'::text]))),
    CONSTRAINT help_tickets_status_check CHECK ((status = ANY (ARRAY['open'::text, 'in_progress'::text, 'resolved'::text, 'closed'::text]))),
    CONSTRAINT help_tickets_type_check CHECK ((type = ANY (ARRAY['bug'::text, 'feature'::text, 'issue'::text, 'contact'::text])))
);


--
-- Name: leaderboard_cache; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.leaderboard_cache (
    id text NOT NULL,
    timeframe text NOT NULL,
    min_volume integer DEFAULT 0 NOT NULL,
    data jsonb NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: market_cache; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.market_cache (
    id text NOT NULL,
    title text NOT NULL,
    description text,
    slug text,
    current_odds integer NOT NULL,
    volume_24h numeric(18,2) DEFAULT 0,
    liquidity numeric(18,2) DEFAULT 0,
    end_date timestamp with time zone,
    category text DEFAULT 'General'::text,
    vera_probability integer,
    edge numeric(10,4),
    confidence text,
    reasoning text,
    recommendation text,
    last_updated timestamp with time zone DEFAULT now() NOT NULL,
    image_url text
);


--
-- Name: positions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.positions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    market_id text NOT NULL,
    market_title text NOT NULL,
    side text NOT NULL,
    entry_price numeric(10,4) NOT NULL,
    current_price numeric(10,4),
    size numeric(18,2) NOT NULL,
    pnl numeric(18,2) DEFAULT 0,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT positions_side_check CHECK ((side = ANY (ARRAY['YES'::text, 'NO'::text])))
);


--
-- Name: price_alerts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.price_alerts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    telegram_chat_id bigint NOT NULL,
    telegram_username text,
    market_url text NOT NULL,
    market_title text NOT NULL,
    target_price numeric NOT NULL,
    direction text DEFAULT 'above'::text NOT NULL,
    current_price numeric,
    triggered boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    triggered_at timestamp with time zone
);


--
-- Name: profiles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.profiles (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    display_name text,
    email text,
    avatar_url text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: system_stats; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.system_stats (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    stats jsonb DEFAULT '{}'::jsonb NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: telegram_followed_markets; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.telegram_followed_markets (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    telegram_chat_id bigint NOT NULL,
    market_url text NOT NULL,
    market_title text NOT NULL,
    last_price numeric,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    last_checked timestamp with time zone DEFAULT now()
);


--
-- Name: twitter_bot_status; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.twitter_bot_status (
    id integer NOT NULL,
    last_mention_id text,
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: user_roles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_roles (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    role public.app_role NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: voice_feedback; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.voice_feedback (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    message_id text NOT NULL,
    conversation_id text NOT NULL,
    message_content text NOT NULL,
    feedback_type text NOT NULL,
    bug_description text,
    user_agent text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT voice_feedback_feedback_type_check CHECK ((feedback_type = ANY (ARRAY['thumbs_up'::text, 'thumbs_down'::text, 'bug_report'::text])))
);


--
-- Name: whale_trades; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.whale_trades (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    market_question text NOT NULL,
    side text NOT NULL,
    size numeric NOT NULL,
    price numeric NOT NULL,
    amount numeric NOT NULL,
    platform text NOT NULL,
    market_url text,
    wallet text,
    "timestamp" timestamp with time zone DEFAULT now() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    trade_hash text,
    CONSTRAINT whale_trades_platform_check CHECK ((platform = ANY (ARRAY['polymarket'::text, 'kalshi'::text]))),
    CONSTRAINT whale_trades_side_check CHECK ((side = ANY (ARRAY['YES'::text, 'NO'::text])))
);


--
-- Name: chat_logs chat_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chat_logs
    ADD CONSTRAINT chat_logs_pkey PRIMARY KEY (id);


--
-- Name: conversation_messages conversation_messages_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.conversation_messages
    ADD CONSTRAINT conversation_messages_pkey PRIMARY KEY (id);


--
-- Name: help_tickets help_tickets_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.help_tickets
    ADD CONSTRAINT help_tickets_pkey PRIMARY KEY (id);


--
-- Name: leaderboard_cache leaderboard_cache_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.leaderboard_cache
    ADD CONSTRAINT leaderboard_cache_pkey PRIMARY KEY (id);


--
-- Name: market_cache market_cache_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.market_cache
    ADD CONSTRAINT market_cache_pkey PRIMARY KEY (id);


--
-- Name: positions positions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.positions
    ADD CONSTRAINT positions_pkey PRIMARY KEY (id);


--
-- Name: price_alerts price_alerts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.price_alerts
    ADD CONSTRAINT price_alerts_pkey PRIMARY KEY (id);


--
-- Name: profiles profiles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_pkey PRIMARY KEY (id);


--
-- Name: profiles profiles_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_user_id_key UNIQUE (user_id);


--
-- Name: system_stats system_stats_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.system_stats
    ADD CONSTRAINT system_stats_pkey PRIMARY KEY (id);


--
-- Name: telegram_followed_markets telegram_followed_markets_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.telegram_followed_markets
    ADD CONSTRAINT telegram_followed_markets_pkey PRIMARY KEY (id);


--
-- Name: telegram_followed_markets telegram_followed_markets_telegram_chat_id_market_url_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.telegram_followed_markets
    ADD CONSTRAINT telegram_followed_markets_telegram_chat_id_market_url_key UNIQUE (telegram_chat_id, market_url);


--
-- Name: twitter_bot_status twitter_bot_status_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.twitter_bot_status
    ADD CONSTRAINT twitter_bot_status_pkey PRIMARY KEY (id);


--
-- Name: user_roles user_roles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_pkey PRIMARY KEY (id);


--
-- Name: user_roles user_roles_user_id_role_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_user_id_role_key UNIQUE (user_id, role);


--
-- Name: voice_feedback voice_feedback_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.voice_feedback
    ADD CONSTRAINT voice_feedback_pkey PRIMARY KEY (id);


--
-- Name: whale_trades whale_trades_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.whale_trades
    ADD CONSTRAINT whale_trades_pkey PRIMARY KEY (id);


--
-- Name: whale_trades whale_trades_trade_hash_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.whale_trades
    ADD CONSTRAINT whale_trades_trade_hash_key UNIQUE (trade_hash);


--
-- Name: idx_conversation_messages_conversation_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_conversation_messages_conversation_id ON public.conversation_messages USING btree (conversation_id, created_at);


--
-- Name: idx_conversation_messages_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_conversation_messages_created_at ON public.conversation_messages USING btree (created_at);


--
-- Name: idx_followed_markets_chat_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_followed_markets_chat_id ON public.telegram_followed_markets USING btree (telegram_chat_id);


--
-- Name: idx_leaderboard_timeframe; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_leaderboard_timeframe ON public.leaderboard_cache USING btree (timeframe, min_volume);


--
-- Name: idx_price_alerts_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_price_alerts_active ON public.price_alerts USING btree (triggered) WHERE (triggered = false);


--
-- Name: idx_price_alerts_chat_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_price_alerts_chat_id ON public.price_alerts USING btree (telegram_chat_id);


--
-- Name: idx_voice_feedback_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_voice_feedback_created ON public.voice_feedback USING btree (created_at DESC);


--
-- Name: idx_voice_feedback_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_voice_feedback_type ON public.voice_feedback USING btree (feedback_type);


--
-- Name: idx_whale_trades_amount; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_whale_trades_amount ON public.whale_trades USING btree (amount DESC);


--
-- Name: idx_whale_trades_platform; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_whale_trades_platform ON public.whale_trades USING btree (platform);


--
-- Name: idx_whale_trades_timestamp; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_whale_trades_timestamp ON public.whale_trades USING btree ("timestamp" DESC);


--
-- Name: positions update_positions_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_positions_updated_at BEFORE UPDATE ON public.positions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: profiles update_profiles_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: positions positions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.positions
    ADD CONSTRAINT positions_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: profiles profiles_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: user_roles user_roles_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: user_roles Admins can delete roles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can delete roles" ON public.user_roles FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: user_roles Admins can insert roles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can insert roles" ON public.user_roles FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: help_tickets Admins can read all tickets; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can read all tickets" ON public.help_tickets FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: help_tickets Admins can update tickets; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can update tickets" ON public.help_tickets FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: user_roles Admins can view all roles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can view all roles" ON public.user_roles FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: help_tickets Anyone can create tickets; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Anyone can create tickets" ON public.help_tickets FOR INSERT WITH CHECK (true);


--
-- Name: conversation_messages Anyone can insert conversation messages; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Anyone can insert conversation messages" ON public.conversation_messages FOR INSERT WITH CHECK (true);


--
-- Name: conversation_messages Anyone can read conversation messages; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Anyone can read conversation messages" ON public.conversation_messages FOR SELECT USING (true);


--
-- Name: leaderboard_cache Anyone can read leaderboard cache; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Anyone can read leaderboard cache" ON public.leaderboard_cache FOR SELECT USING (true);


--
-- Name: market_cache Anyone can read market cache; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Anyone can read market cache" ON public.market_cache FOR SELECT USING (true);


--
-- Name: system_stats Anyone can read system stats; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Anyone can read system stats" ON public.system_stats FOR SELECT USING (true);


--
-- Name: whale_trades Anyone can read whale trades; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Anyone can read whale trades" ON public.whale_trades FOR SELECT USING (true);


--
-- Name: voice_feedback Anyone can submit feedback; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Anyone can submit feedback" ON public.voice_feedback FOR INSERT WITH CHECK (true);


--
-- Name: chat_logs Service role can manage chat logs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Service role can manage chat logs" ON public.chat_logs USING (true) WITH CHECK (true);


--
-- Name: telegram_followed_markets Service role can manage followed markets; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Service role can manage followed markets" ON public.telegram_followed_markets USING (true) WITH CHECK (true);


--
-- Name: leaderboard_cache Service role can manage leaderboard cache; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Service role can manage leaderboard cache" ON public.leaderboard_cache USING (true) WITH CHECK (true);


--
-- Name: price_alerts Service role can manage price alerts; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Service role can manage price alerts" ON public.price_alerts USING (true) WITH CHECK (true);


--
-- Name: help_tickets Service role can manage tickets; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Service role can manage tickets" ON public.help_tickets USING (true) WITH CHECK (true);


--
-- Name: twitter_bot_status Service role can manage twitter bot status; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Service role can manage twitter bot status" ON public.twitter_bot_status USING (true) WITH CHECK (true);


--
-- Name: voice_feedback Service role can read feedback; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Service role can read feedback" ON public.voice_feedback FOR SELECT USING (false);


--
-- Name: positions Users can delete their own positions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete their own positions" ON public.positions FOR DELETE USING ((auth.uid() = user_id));


--
-- Name: positions Users can insert their own positions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert their own positions" ON public.positions FOR INSERT WITH CHECK ((auth.uid() = user_id));


--
-- Name: profiles Users can insert their own profile; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert their own profile" ON public.profiles FOR INSERT WITH CHECK ((auth.uid() = user_id));


--
-- Name: positions Users can update their own positions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update their own positions" ON public.positions FOR UPDATE USING ((auth.uid() = user_id));


--
-- Name: profiles Users can update their own profile; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update their own profile" ON public.profiles FOR UPDATE USING ((auth.uid() = user_id));


--
-- Name: positions Users can view their own positions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view their own positions" ON public.positions FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: profiles Users can view their own profile; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view their own profile" ON public.profiles FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: chat_logs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.chat_logs ENABLE ROW LEVEL SECURITY;

--
-- Name: conversation_messages; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.conversation_messages ENABLE ROW LEVEL SECURITY;

--
-- Name: help_tickets; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.help_tickets ENABLE ROW LEVEL SECURITY;

--
-- Name: leaderboard_cache; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.leaderboard_cache ENABLE ROW LEVEL SECURITY;

--
-- Name: market_cache; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.market_cache ENABLE ROW LEVEL SECURITY;

--
-- Name: positions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.positions ENABLE ROW LEVEL SECURITY;

--
-- Name: price_alerts; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.price_alerts ENABLE ROW LEVEL SECURITY;

--
-- Name: profiles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

--
-- Name: system_stats; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.system_stats ENABLE ROW LEVEL SECURITY;

--
-- Name: telegram_followed_markets; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.telegram_followed_markets ENABLE ROW LEVEL SECURITY;

--
-- Name: twitter_bot_status; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.twitter_bot_status ENABLE ROW LEVEL SECURITY;

--
-- Name: user_roles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

--
-- Name: voice_feedback; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.voice_feedback ENABLE ROW LEVEL SECURITY;

--
-- Name: whale_trades; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.whale_trades ENABLE ROW LEVEL SECURITY;

--
-- PostgreSQL database dump complete
--




COMMIT;