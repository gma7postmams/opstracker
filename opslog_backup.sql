--
-- PostgreSQL database dump
--

\restrict vbSy2ZFFbMsksdzY6s7cglIMjpHioSvnpuygRWy4sePBDklfnyxLvX9QgC3Yxga

-- Dumped from database version 17.11 (Homebrew)
-- Dumped by pg_dump version 17.11 (Homebrew)

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
-- Name: MasterKind; Type: TYPE; Schema: public; Owner: eugenehorfilla
--

CREATE TYPE public."MasterKind" AS ENUM (
    'LOCATION',
    'SHIFT',
    'SHOW_GROUP',
    'CATEGORY',
    'ACTIVITY_TYPE'
);


ALTER TYPE public."MasterKind" OWNER TO eugenehorfilla;

--
-- Name: Priority; Type: TYPE; Schema: public; Owner: eugenehorfilla
--

CREATE TYPE public."Priority" AS ENUM (
    'LOW',
    'NORMAL',
    'HIGH',
    'CRITICAL'
);


ALTER TYPE public."Priority" OWNER TO eugenehorfilla;

--
-- Name: Role; Type: TYPE; Schema: public; Owner: eugenehorfilla
--

CREATE TYPE public."Role" AS ENUM (
    'ADMIN',
    'USER'
);


ALTER TYPE public."Role" OWNER TO eugenehorfilla;

--
-- Name: Status; Type: TYPE; Schema: public; Owner: eugenehorfilla
--

CREATE TYPE public."Status" AS ENUM (
    'OPEN',
    'CLOSE_PENDING',
    'CLOSED'
);


ALTER TYPE public."Status" OWNER TO eugenehorfilla;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: _prisma_migrations; Type: TABLE; Schema: public; Owner: eugenehorfilla
--

CREATE TABLE public._prisma_migrations (
    id character varying(36) NOT NULL,
    checksum character varying(64) NOT NULL,
    finished_at timestamp with time zone,
    migration_name character varying(255) NOT NULL,
    logs text,
    rolled_back_at timestamp with time zone,
    started_at timestamp with time zone DEFAULT now() NOT NULL,
    applied_steps_count integer DEFAULT 0 NOT NULL
);


ALTER TABLE public._prisma_migrations OWNER TO eugenehorfilla;

--
-- Name: ai_settings; Type: TABLE; Schema: public; Owner: eugenehorfilla
--

CREATE TABLE public.ai_settings (
    id integer DEFAULT 1 NOT NULL,
    "macoEnabled" boolean DEFAULT false NOT NULL,
    provider text DEFAULT 'ollama'::text NOT NULL,
    "baseUrl" text DEFAULT 'http://localhost:11434'::text NOT NULL,
    model text DEFAULT 'llama3.1:8b'::text NOT NULL,
    temperature double precision DEFAULT 0.2 NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


ALTER TABLE public.ai_settings OWNER TO eugenehorfilla;

--
-- Name: assistance; Type: TABLE; Schema: public; Owner: eugenehorfilla
--

CREATE TABLE public.assistance (
    id integer NOT NULL,
    ref_no text NOT NULL,
    date date NOT NULL,
    shift text NOT NULL,
    location text NOT NULL,
    show_group text,
    client_name text NOT NULL,
    problem text NOT NULL,
    category text NOT NULL,
    resolution text,
    priority public."Priority" DEFAULT 'NORMAL'::public."Priority" NOT NULL,
    time_started character varying(5) NOT NULL,
    time_ended character varying(5),
    status public."Status" DEFAULT 'OPEN'::public."Status" NOT NULL,
    assigned text NOT NULL,
    accountable text NOT NULL,
    remarks text,
    owner_id integer,
    locked boolean DEFAULT false NOT NULL,
    locked_by_id integer,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) without time zone NOT NULL
);


ALTER TABLE public.assistance OWNER TO eugenehorfilla;

--
-- Name: assistance_id_seq; Type: SEQUENCE; Schema: public; Owner: eugenehorfilla
--

CREATE SEQUENCE public.assistance_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.assistance_id_seq OWNER TO eugenehorfilla;

--
-- Name: assistance_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: eugenehorfilla
--

ALTER SEQUENCE public.assistance_id_seq OWNED BY public.assistance.id;


--
-- Name: audit_logs; Type: TABLE; Schema: public; Owner: eugenehorfilla
--

CREATE TABLE public.audit_logs (
    id integer NOT NULL,
    action text NOT NULL,
    entity_type text NOT NULL,
    entity_id text,
    user_id integer,
    details jsonb,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public.audit_logs OWNER TO eugenehorfilla;

--
-- Name: audit_logs_id_seq; Type: SEQUENCE; Schema: public; Owner: eugenehorfilla
--

CREATE SEQUENCE public.audit_logs_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.audit_logs_id_seq OWNER TO eugenehorfilla;

--
-- Name: audit_logs_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: eugenehorfilla
--

ALTER SEQUENCE public.audit_logs_id_seq OWNED BY public.audit_logs.id;


--
-- Name: branding; Type: TABLE; Schema: public; Owner: eugenehorfilla
--

CREATE TABLE public.branding (
    id integer DEFAULT 1 NOT NULL,
    title text DEFAULT 'OpsLog'::text NOT NULL,
    tagline text DEFAULT 'Operations Platform'::text NOT NULL,
    logo_url text,
    favicon_url text,
    updated_at timestamp(3) without time zone NOT NULL
);


ALTER TABLE public.branding OWNER TO eugenehorfilla;

--
-- Name: counters; Type: TABLE; Schema: public; Owner: eugenehorfilla
--

CREATE TABLE public.counters (
    key text NOT NULL,
    value integer DEFAULT 0 NOT NULL
);


ALTER TABLE public.counters OWNER TO eugenehorfilla;

--
-- Name: master_data; Type: TABLE; Schema: public; Owner: eugenehorfilla
--

CREATE TABLE public.master_data (
    id integer NOT NULL,
    kind public."MasterKind" NOT NULL,
    value text NOT NULL,
    active boolean DEFAULT true NOT NULL,
    sort integer DEFAULT 0 NOT NULL
);


ALTER TABLE public.master_data OWNER TO eugenehorfilla;

--
-- Name: master_data_id_seq; Type: SEQUENCE; Schema: public; Owner: eugenehorfilla
--

CREATE SEQUENCE public.master_data_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.master_data_id_seq OWNER TO eugenehorfilla;

--
-- Name: master_data_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: eugenehorfilla
--

ALTER SEQUENCE public.master_data_id_seq OWNED BY public.master_data.id;


--
-- Name: tasks; Type: TABLE; Schema: public; Owner: eugenehorfilla
--

CREATE TABLE public.tasks (
    id integer NOT NULL,
    ref_no text NOT NULL,
    date date NOT NULL,
    shift text NOT NULL,
    location text NOT NULL,
    show_group text,
    activity_type text NOT NULL,
    description text NOT NULL,
    priority public."Priority" DEFAULT 'NORMAL'::public."Priority" NOT NULL,
    time_started character varying(5) NOT NULL,
    time_ended character varying(5),
    status public."Status" DEFAULT 'OPEN'::public."Status" NOT NULL,
    assigned text NOT NULL,
    accountable text NOT NULL,
    remarks text,
    owner_id integer,
    locked boolean DEFAULT false NOT NULL,
    locked_by_id integer,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) without time zone NOT NULL
);


ALTER TABLE public.tasks OWNER TO eugenehorfilla;

--
-- Name: tasks_id_seq; Type: SEQUENCE; Schema: public; Owner: eugenehorfilla
--

CREATE SEQUENCE public.tasks_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.tasks_id_seq OWNER TO eugenehorfilla;

--
-- Name: tasks_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: eugenehorfilla
--

ALTER SEQUENCE public.tasks_id_seq OWNED BY public.tasks.id;


--
-- Name: users; Type: TABLE; Schema: public; Owner: eugenehorfilla
--

CREATE TABLE public.users (
    id integer NOT NULL,
    first_name text NOT NULL,
    middle_initial character varying(1),
    surname text NOT NULL,
    email text NOT NULL,
    username text NOT NULL,
    password_hash text NOT NULL,
    role public."Role" DEFAULT 'USER'::public."Role" NOT NULL,
    avatar_url text,
    active boolean DEFAULT true NOT NULL,
    last_login timestamp(3) without time zone,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    smtp_email text,
    smtp_enabled boolean DEFAULT false NOT NULL,
    smtp_password text,
    smtp_recipients text
);


ALTER TABLE public.users OWNER TO eugenehorfilla;

--
-- Name: users_id_seq; Type: SEQUENCE; Schema: public; Owner: eugenehorfilla
--

CREATE SEQUENCE public.users_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.users_id_seq OWNER TO eugenehorfilla;

--
-- Name: users_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: eugenehorfilla
--

ALTER SEQUENCE public.users_id_seq OWNED BY public.users.id;


--
-- Name: assistance id; Type: DEFAULT; Schema: public; Owner: eugenehorfilla
--

ALTER TABLE ONLY public.assistance ALTER COLUMN id SET DEFAULT nextval('public.assistance_id_seq'::regclass);


--
-- Name: audit_logs id; Type: DEFAULT; Schema: public; Owner: eugenehorfilla
--

ALTER TABLE ONLY public.audit_logs ALTER COLUMN id SET DEFAULT nextval('public.audit_logs_id_seq'::regclass);


--
-- Name: master_data id; Type: DEFAULT; Schema: public; Owner: eugenehorfilla
--

ALTER TABLE ONLY public.master_data ALTER COLUMN id SET DEFAULT nextval('public.master_data_id_seq'::regclass);


--
-- Name: tasks id; Type: DEFAULT; Schema: public; Owner: eugenehorfilla
--

ALTER TABLE ONLY public.tasks ALTER COLUMN id SET DEFAULT nextval('public.tasks_id_seq'::regclass);


--
-- Name: users id; Type: DEFAULT; Schema: public; Owner: eugenehorfilla
--

ALTER TABLE ONLY public.users ALTER COLUMN id SET DEFAULT nextval('public.users_id_seq'::regclass);


--
-- Data for Name: _prisma_migrations; Type: TABLE DATA; Schema: public; Owner: eugenehorfilla
--

COPY public._prisma_migrations (id, checksum, finished_at, migration_name, logs, rolled_back_at, started_at, applied_steps_count) FROM stdin;
4a548a04-091d-4c62-b7eb-d073ddf520df	1bff9312636a8171e1a88079439875460959cca705c4606d922a05162cff2441	2026-09-02 15:49:20.369951+08	20260902074920_init	\N	\N	2026-09-02 15:49:20.340921+08	1
baf42f0f-d4d7-4fd8-a23a-5b52d79b4a4b	45fb6136b1dffb9cb6e0b778678dff984ffe5d099b8528bcf211b29959f527d7	2026-09-04 14:55:57.167379+08	20260904065557_add_audit_logs	\N	\N	2026-09-04 14:55:57.16144+08	1
d4db55de-ea72-4054-8108-07af652eb123	28f67ea5f360c046ffcc5d99789398dd7fa70ad2ee5a36f5738c91f550b59bc7	2026-09-08 18:30:55.803504+08	20260908103055_add_email_report_settings	\N	\N	2026-09-08 18:30:55.799415+08	1
2e010b25-77c6-4f44-9451-c33c37a96778	865233eef2ff00e278b5b0622bd0e15db607ce90ddcd706fe0e3284165c04469	2026-09-24 14:41:27.471199+08	20260924064127_add_maco_settings	\N	\N	2026-09-24 14:41:27.463517+08	1
\.


--
-- Data for Name: ai_settings; Type: TABLE DATA; Schema: public; Owner: eugenehorfilla
--

COPY public.ai_settings (id, "macoEnabled", provider, "baseUrl", model, temperature, "createdAt", "updatedAt") FROM stdin;
\.


--
-- Data for Name: assistance; Type: TABLE DATA; Schema: public; Owner: eugenehorfilla
--

COPY public.assistance (id, ref_no, date, shift, location, show_group, client_name, problem, category, resolution, priority, time_started, time_ended, status, assigned, accountable, remarks, owner_id, locked, locked_by_id, created_at, updated_at) FROM stdin;
23	TA-2026-00023	2026-10-14	10AM -7PM	MAMS Office	FIREWALL	Geraldine	Unable to search placeholders for BV_THEMAS_103126 (5 segments).	Publishing	Placeholders not yet updated. Informed Mamstech to update the five items.	NORMAL	18:36	16:52	CLOSE_PENDING	EUGENE B. HORFILLA	EUGENE B. HORFILLA	Solved.	12	f	\N	2026-10-14 10:39:58.487	2026-10-20 08:52:33.155
\.


--
-- Data for Name: audit_logs; Type: TABLE DATA; Schema: public; Owner: eugenehorfilla
--

COPY public.audit_logs (id, action, entity_type, entity_id, user_id, details, created_at) FROM stdin;
1	CREATE	assistance	TA-2026-00002	12	\N	2026-09-04 07:16:51.798
2	LOCK	assistance	TA-2026-00002	12	\N	2026-09-04 07:18:34.64
3	UNLOCK	assistance	TA-2026-00002	12	\N	2026-09-04 07:18:50.96
4	UPDATE	assistance	TA-2026-00002	12	{"recordId": 2}	2026-09-04 07:19:12.726
5	DELETE	assistance	TA-2026-00002	12	{"name": "EUGENE B. HORFILLA"}	2026-09-04 07:56:55.524
6	CREATE	assistance	TA-2026-00003	12	{"name": "EUGENE B. HORFILLA"}	2026-09-04 07:57:57.502
7	LOGIN	auth	\N	12	{"name": "EUGENE B. HORFILLA", "username": "ebhorfilla"}	2026-09-04 10:27:51.03
8	LOGOUT	auth	\N	12	{"name": "EUGENE B. HORFILLA"}	2026-09-04 10:42:24.269
9	LOGIN	auth	\N	12	{"name": "EUGENE B. HORFILLA", "username": "ebhorfilla"}	2026-09-04 10:42:28.515
10	MASTERDATA_ADD	SHOW_GROUP	\N	12	{"name": "EUGENE B. HORFILLA", "value": "FIREWALL"}	2026-09-04 10:42:49.882
11	MASTERDATA_ADD	LOCATION	\N	12	{"name": "EUGENE B. HORFILLA", "value": "Premiere-LF-02"}	2026-09-04 10:42:59.213
12	LOGOUT	auth	\N	12	{"name": "EUGENE B. HORFILLA"}	2026-09-04 10:48:38.773
13	LOGIN	auth	\N	12	{"name": "EUGENE B. HORFILLA", "username": "ebhorfilla"}	2026-09-04 10:48:43.502
14	MASTERDATA_RETIRE	LOCATION	Premiere-LF-02	12	{"name": "EUGENE B. HORFILLA", "value": "Premiere-LF-02"}	2026-09-04 10:48:55.05
15	MASTERDATA_ADD	SHIFT	10AM - 6PM	12	{"name": "EUGENE B. HORFILLA", "value": "10AM - 6PM"}	2026-09-04 10:58:19.648
16	MASTERDATA_RESTORE	LOCATION	Premiere-LF-02	12	{"name": "EUGENE B. HORFILLA", "value": "Premiere-LF-02"}	2026-09-04 11:05:45.686
17	LOGOUT	auth	Successful Logout	12	{"name": "EUGENE B. HORFILLA"}	2026-09-04 11:23:38.623
18	LOGIN_FAILED	auth	Invalid Username or Password	\N	{"username": "ebhorfilla"}	2026-09-04 11:23:45.135
19	LOGIN	auth	Successful Login	12	{"name": "EUGENE B. HORFILLA", "username": "ebhorfilla"}	2026-09-04 11:23:45.14
20	LOGOUT	auth	Successful Logout	12	{"name": "EUGENE B. HORFILLA"}	2026-09-04 11:23:53.531
21	LOGIN_FAILED	auth	Invalid Username or Password	\N	{"username": "ebhorfilla"}	2026-09-04 11:24:07.722
22	LOGIN	auth	Successful Login	12	{"name": "EUGENE B. HORFILLA", "username": "ebhorfilla"}	2026-09-04 11:24:07.727
23	LOGOUT	auth	Successful Logout	12	{"name": "EUGENE B. HORFILLA"}	2026-09-04 11:26:24.552
24	LOGIN_FAILED	auth	Invalid Username or Password	\N	{"username": "ebhorfilla"}	2026-09-04 11:26:33.041
25	LOGIN	auth	Successful Login	12	{"name": "EUGENE B. HORFILLA", "username": "ebhorfilla"}	2026-09-04 11:26:33.046
26	LOGIN_FAILED	auth	Invalid Username or Password	\N	{"username": "ebhorfilla"}	2026-09-04 11:40:54.035
27	LOGIN	auth	Successful Login	12	{"name": "EUGENE B. HORFILLA", "username": "ebhorfilla"}	2026-09-04 11:40:54.049
28	LOGOUT	auth	Successful Logout	12	{"name": "EUGENE B. HORFILLA"}	2026-09-04 11:41:51.347
29	LOGIN_FAILED	auth	Invalid Username or Password	\N	{"username": "ebhorfilla"}	2026-09-04 11:41:55.62
30	LOGIN	auth	Successful Login	12	{"name": "EUGENE B. HORFILLA", "username": "ebhorfilla"}	2026-09-04 11:41:55.623
31	LOGOUT	auth	Successful Logout	12	{"name": "EUGENE B. HORFILLA"}	2026-09-04 11:42:17.953
32	LOGIN_FAILED	auth	Invalid Username or Password	\N	{"username": "ebhorfilla"}	2026-09-04 11:42:25.108
33	LOGIN	auth	Successful Login	12	{"name": "EUGENE B. HORFILLA", "username": "ebhorfilla"}	2026-09-04 11:42:25.118
34	LOGOUT	auth	Successful Logout	12	{"name": "EUGENE B. HORFILLA"}	2026-09-04 11:42:48.32
35	LOGIN_FAILED	auth	Invalid Username or Password	\N	{"username": "ebhorfilla"}	2026-09-04 11:42:51.195
36	LOGIN	auth	Successful Login	12	{"name": "EUGENE B. HORFILLA", "username": "ebhorfilla"}	2026-09-04 11:42:51.198
37	LOGOUT	auth	Successful Logout	12	{"name": "EUGENE B. HORFILLA"}	2026-09-04 11:48:42.821
38	LOGIN	auth	Successful Login	12	{"name": "EUGENE B. HORFILLA", "username": "ebhorfilla"}	2026-09-04 11:48:46.38
39	LOGOUT	auth	Successful Logout	12	{"name": "EUGENE B. HORFILLA"}	2026-09-04 11:48:52.95
40	LOGIN_FAILED	auth	Invalid Username or Password	\N	{"username": "ebhorfilla"}	2026-09-04 11:48:57.803
41	LOGIN	auth	Successful Login	12	{"name": "EUGENE B. HORFILLA", "username": "ebhorfilla"}	2026-09-04 11:49:00.641
42	LOGOUT	auth	Successful Logout	12	{"name": "EUGENE B. HORFILLA"}	2026-09-04 11:49:41.215
43	LOGIN	auth	Successful Login	12	{"name": "EUGENE B. HORFILLA", "username": "ebhorfilla"}	2026-09-04 11:51:34.9
44	LOGOUT	auth	Successful Logout	12	{"name": "EUGENE B. HORFILLA"}	2026-09-04 13:09:59.343
45	LOGIN	auth	Successful Login	12	{"name": "EUGENE B. HORFILLA", "username": "ebhorfilla"}	2026-09-07 03:44:41.58
46	LOGOUT	auth	Successful Logout	12	{"name": "EUGENE B. HORFILLA"}	2026-09-07 09:29:04.964
47	LOGIN	auth	Successful Login	1	{"name": "System Administrator", "username": "admin"}	2026-09-07 09:29:13.116
48	LOGOUT	auth	Successful Logout	1	{"name": "System Administrator"}	2026-09-07 09:29:29.649
49	LOGIN_FAILED	auth	Invalid Username or Password	\N	{"username": "postmams"}	2026-09-07 09:29:29.979
50	LOGIN	auth	Successful Login	12	{"name": "EUGENE B. HORFILLA", "username": "ebhorfilla"}	2026-09-07 09:29:34.386
51	LOGIN_FAILED	auth	Invalid Username or Password	\N	{"username": "admin"}	2026-09-07 09:29:38.789
52	LOGIN	auth	Successful Login	1	{"name": "System Administrator", "username": "admin"}	2026-09-07 09:30:54.236
53	LOCK	assistance	TA-2026-00003	1	{"name": "System Administrator"}	2026-09-07 09:31:09.901
54	UNLOCK	assistance	TA-2026-00003	1	{"name": "System Administrator"}	2026-09-07 09:31:11.441
55	LOGOUT	auth	Successful Logout	12	{"name": "EUGENE B. HORFILLA"}	2026-09-07 09:31:56.126
56	LOGIN	auth	Successful Login	12	{"name": "EUGENE B. HORFILLA", "username": "ebhorfilla"}	2026-09-07 09:32:00.292
57	LOGOUT	auth	Successful Logout	12	{"name": "EUGENE B. HORFILLA"}	2026-09-07 11:54:01.717
58	LOGIN	auth	Successful Login	12	{"name": "EUGENE B. HORFILLA", "username": "ebhorfilla"}	2026-09-07 11:54:05.66
59	LOGOUT	auth	Successful Logout	12	{"name": "EUGENE B. HORFILLA"}	2026-09-07 11:58:35.447
60	LOGIN	auth	Successful Login	12	{"name": "EUGENE B. HORFILLA", "username": "ebhorfilla"}	2026-09-07 11:58:38.558
61	LOGIN	auth	Successful Login	12	{"name": "EUGENE B. HORFILLA", "username": "ebhorfilla"}	2026-09-07 12:00:10.764
62	LOGIN	auth	Successful Login	12	{"name": "EUGENE B. HORFILLA", "username": "ebhorfilla"}	2026-09-07 12:36:14.599
63	LOGOUT	auth	Successful Logout	12	{"name": "EUGENE B. HORFILLA"}	2026-09-07 12:42:52.706
64	LOGIN_FAILED	auth	Invalid Username or Password	\N	{"username": "postmams"}	2026-09-07 14:34:21.817
65	LOGIN_FAILED	auth	Invalid Username or Password	\N	{"username": "postmams"}	2026-09-07 14:34:30.901
66	LOGIN_FAILED	auth	Invalid Username or Password	\N	{"username": "postmams"}	2026-09-07 14:34:32.317
67	LOGIN_FAILED	auth	Invalid Username or Password	\N	{"username": "testuser1"}	2026-09-07 14:34:39.916
68	LOGIN_FAILED	auth	Invalid Username or Password	\N	{"username": "testuser1"}	2026-09-07 14:34:41.052
69	LOGIN_FAILED	auth	Invalid Username or Password	\N	{"username": "testuser1"}	2026-09-07 14:34:41.665
70	LOGIN_FAILED	auth	Invalid Username or Password	\N	{"username": "testuser1"}	2026-09-07 14:34:42.195
71	LOGIN_FAILED	auth	Invalid Username or Password	\N	{"username": "testuser1"}	2026-09-07 14:34:42.504
72	LOGIN_FAILED	auth	Invalid Username or Password	\N	{"username": "postmams"}	2026-09-07 14:34:59.833
73	LOGIN	auth	Successful Login	1	{"name": "System Administrator", "username": "admin"}	2026-09-08 01:34:17.208
74	LOGOUT	auth	Successful Logout	1	{"name": "System Administrator"}	2026-09-08 01:36:17.902
75	LOGIN	auth	Successful Login	13	{"name": "Rodrigo E. Leynes", "username": "releynes"}	2026-09-08 01:36:24.81
76	LOGIN	auth	Successful Login	12	{"name": "EUGENE B. HORFILLA", "username": "ebhorfilla"}	2026-09-08 04:05:06.658
77	LOGOUT	auth	Successful Logout	12	{"name": "EUGENE B. HORFILLA"}	2026-09-08 04:05:25.199
78	LOGIN	auth	Successful Login	12	{"name": "EUGENE B. HORFILLA", "username": "ebhorfilla"}	2026-09-08 04:46:04.202
79	LOGOUT	auth	Successful Logout	12	{"name": "EUGENE B. HORFILLA"}	2026-09-08 07:25:11.989
80	LOGIN	auth	Successful Login	12	{"name": "EUGENE B. HORFILLA", "username": "ebhorfilla"}	2026-09-08 07:26:17.278
81	LOGOUT	auth	Successful Logout	12	{"name": "EUGENE B. HORFILLA"}	2026-09-08 11:06:55.355
82	LOGIN	auth	Successful Login	12	{"name": "EUGENE B. HORFILLA", "username": "ebhorfilla"}	2026-09-08 11:06:58.274
83	REPORT_EMAIL_SENT	REPORT	2026-09-01 to 2026-09-08	12	{"recipients": "ebhorfilla@gmanetwork.com"}	2026-09-08 11:48:16.269
84	REPORT_EMAIL_SENT	REPORT	2026-09-01 to 2026-09-08	12	{"user": "EUGENE B. HORFILLA", "sender": "gma7postmams@gmail.com", "status": "all", "activity": "all", "filename": "OpsLog_Report_2026-09-01_to_2026-09-08.xlsx", "recipients": "ebhorfilla@gmanetwork.com"}	2026-09-08 12:05:21.306
85	REPORT_EMAIL_SENT	REPORT	2026-09-01 to 2026-09-08	12	{"user": "EUGENE B. HORFILLA", "sender": "gma7postmams@gmail.com", "status": "all", "activity": "all", "filename": "OpsLog_Report_2026-09-01_to_2026-09-08.xlsx", "recipients": "ebhorfilla@gmanetwork.com"}	2026-09-08 12:14:22.894
86	REPORT_EMAIL_SENT	REPORT	2026-09-01 to 2026-09-08	12	{"user": "EUGENE B. HORFILLA", "sender": "gma7postmams@gmail.com", "status": "all", "activity": "all", "filename": "OpsLog_Report_2026-09-01_to_2026-09-08.xlsx", "recipients": "ebhorfilla@gmanetwork.com"}	2026-09-08 12:36:10.425
87	LOGIN	auth	Successful Login	12	{"name": "EUGENE B. HORFILLA", "username": "ebhorfilla"}	2026-09-08 12:41:36.214
88	LOGOUT	auth	Successful Logout	12	{"name": "EUGENE B. HORFILLA"}	2026-09-08 12:44:25.369
89	LOGOUT	auth	Successful Logout	12	{"name": "EUGENE B. HORFILLA"}	2026-09-08 12:56:13.752
90	LOGIN	auth	Successful Login	12	{"name": "EUGENE B. HORFILLA", "username": "ebhorfilla"}	2026-09-08 12:56:19.578
91	LOGIN	auth	Successful Login	12	{"name": "EUGENE B. HORFILLA", "username": "ebhorfilla"}	2026-09-09 04:11:31.4
92	REPORT_EMAIL_SENT	REPORT	2026-09-01 to 2026-09-09	12	{"user": "EUGENE B. HORFILLA", "sender": "mreugene2005@gmail.com", "status": "all", "activity": "all", "filename": "OpsLog_Report_2026-09-01_to_2026-09-09.xlsx", "recipients": "ebhorfilla@gmanetwork.com"}	2026-09-09 05:27:40.98
93	REPORT_EMAIL_SENT	REPORT	2026-09-01 to 2026-09-09	12	{"user": "EUGENE B. HORFILLA", "sender": "mreugene2005@gmail.com", "status": "all", "activity": "all", "filename": "OpsLog_Report_2026-09-01_to_2026-09-09.xlsx", "recipients": "ebhorfilla@gmanetwork.com"}	2026-09-09 06:07:40.472
94	LOGIN_FAILED	auth	Invalid Username or Password	\N	{"username": "ebhorfilla"}	2026-09-09 12:12:05.98
95	LOGIN	auth	Successful Login	12	{"name": "EUGENE B. HORFILLA", "username": "ebhorfilla"}	2026-09-09 12:12:12.652
96	LOGOUT	auth	Successful Logout	12	{"name": "EUGENE B. HORFILLA"}	2026-09-09 12:35:43.85
97	LOGIN	auth	Successful Login	12	{"name": "EUGENE B. HORFILLA", "username": "ebhorfilla"}	2026-09-10 03:53:58.591
98	REPORT_EMAIL_FAILED	REPORT	2026-09-01 to 2026-09-10	12	{"user": "EUGENE B. HORFILLA", "error": "Invalid login: 535-5.7.8 Username and Password not accepted. For more information, go to\\n535 5.7.8  https://support.google.com/mail/?p=BadCredentials d9443c01a7336-2db14ae7637sm83256155ad.79 - gsmtp", "sender": "mreugene2005@gmail.com", "status": "all", "activity": "all", "filename": "OpsLog_Report_2026-09-01_to_2026-09-10.xlsx", "recipients": "ebhorfilla@gmanetwork.com"}	2026-09-10 06:25:04.781
99	REPORT_EMAIL_SENT	REPORT	2026-09-01 to 2026-09-10	12	{"user": "EUGENE B. HORFILLA", "sender": "mreugene2005@gmail.com", "status": "all", "activity": "all", "filename": "OpsLog_Report_2026-09-01_to_2026-09-10.xlsx", "recipients": "ebhorfilla@gmanetwork.com"}	2026-09-10 06:25:39.335
100	REPORT_EMAIL_SENT	REPORT	2026-09-01 to 2026-09-10	12	{"user": "EUGENE B. HORFILLA", "sender": "mreugene2005@gmail.com", "status": "all", "activity": "all", "filename": "OpsLog_Report_2026-09-01_to_2026-09-10.xlsx", "recipients": "ebhorfilla@gmanetwork.com"}	2026-09-10 06:33:17.18
101	REPORT_EMAIL_SENT	REPORT	2026-09-01 to 2026-09-10	12	{"user": "EUGENE B. HORFILLA", "sender": "mreugene2005@gmail.com", "status": "all", "activity": "all", "filename": "OpsLog_Report_2026-09-01_to_2026-09-10.xlsx", "recipients": "ebhorfilla@gmanetwork.com"}	2026-09-10 06:42:04.357
102	REPORT_EMAIL_SENT	REPORT	2026-09-01 to 2026-09-10	12	{"user": "EUGENE B. HORFILLA", "sender": "mreugene2005@gmail.com", "status": "all", "activity": "all", "filename": "OpsLog_Report_2026-09-01_to_2026-09-10.xlsx", "recipients": "ebhorfilla@gmanetwork.com"}	2026-09-10 06:47:06.971
103	LOGIN	auth	Successful Login	12	{"name": "EUGENE B. HORFILLA", "username": "ebhorfilla"}	2026-09-15 12:08:57.757
104	REPORT_EMAIL_SENT	REPORT	2026-09-01 to 2026-09-15	12	{"user": "EUGENE B. HORFILLA", "sender": "mreugene2005@gmail.com", "status": "all", "activity": "all", "filename": "OpsLog_Report_2026-09-01_to_2026-09-15.xlsx", "recipients": "ebhorfilla@gmanetwork.com"}	2026-09-15 12:19:03.636
105	LOGIN	auth	Successful Login	12	{"name": "EUGENE B. HORFILLA", "username": "ebhorfilla"}	2026-09-16 06:34:46.982
106	IMPORT_BOTH	workbook	\N	12	{"scope": "admin", "format": "excel", "filename": "OpsTracker_Import_Template.xlsx", "taskImported": 1, "totalImported": 2, "assistanceImported": 1}	2026-09-16 11:26:00.364
107	IMPORT_BOTH	IMPORT	Successfully Imported 2 Records	12	{"user": "EUGENE B. HORFILLA", "scope": "admin", "format": "excel", "filename": "OpsTracker_Import_Template.xlsx", "taskImported": 1, "totalImported": 2, "assistanceImported": 1}	2026-09-16 11:34:34.628
108	IMPORT	IMPORT	Successfully Imported 1 Records	12	{"user": "EUGENE B. HORFILLA", "scope": "admin", "failed": 0, "format": "excel", "filename": "OpsTracker_Import_Template.xlsx", "imported": 1, "sheetUsed": "Technical Assistance"}	2026-09-16 11:37:32.137
109	IMPORT	IMPORT	Successfully Imported 1 Records	12	{"user": "EUGENE B. HORFILLA", "scope": "admin", "failed": 0, "format": "excel", "filename": "OpsTracker_Import_Template.xlsx", "imported": 1, "sheetUsed": "Other Tasks"}	2026-09-16 11:37:47.138
110	IMPORT	Technical Assistance	Successfully Imported 1 Records	12	{"user": "EUGENE B. HORFILLA", "scope": "admin", "failed": 0, "format": "excel", "filename": "OpsTracker_Import_Template.xlsx", "imported": 1, "sheetUsed": "Technical Assistance"}	2026-09-16 12:13:23.343
111	IMPORT	Other Tasks	Successfully Imported 1 Records	12	{"user": "EUGENE B. HORFILLA", "scope": "admin", "failed": 0, "format": "excel", "filename": "OpsTracker_Import_Template.xlsx", "imported": 1, "sheetUsed": "Other Tasks"}	2026-09-16 12:13:37.204
112	IMPORT_BOTH	Workbook	Successfully Imported 2 Records	12	{"user": "EUGENE B. HORFILLA", "scope": "admin", "format": "excel", "filename": "OpsTracker_Import_Template.xlsx", "taskImported": 1, "totalImported": 2, "assistanceImported": 1}	2026-09-16 12:14:23.509
113	LOGIN_FAILED	auth	Invalid Username or Password	\N	{"username": "postmams"}	2026-09-16 13:07:21.884
114	LOGIN	auth	Successful Login	12	{"name": "EUGENE B. HORFILLA", "username": "ebhorfilla"}	2026-09-16 13:07:29.734
115	REPORT_EMAIL_SENT	REPORT	2026-09-16 to 2026-09-16	12	{"user": "EUGENE B. HORFILLA", "sender": "mreugene2005@gmail.com", "status": "all", "activity": "all", "filename": "OpsLog_Report_2026-09-16_to_2026-09-16.xlsx", "recipients": "ebhorfilla@gmanetwork.com"}	2026-09-16 13:08:17.222
116	IMPORT_BOTH	Workbook	Successfully Imported 2 Records	12	{"user": "EUGENE B. HORFILLA", "scope": "admin", "format": "excel", "filename": "OpsTracker_Import_Template.xlsx", "taskImported": 1, "totalImported": 2, "assistanceImported": 1}	2026-09-16 13:10:10.484
117	DELETE	assistance	TA-2026-00004	12	{"name": "EUGENE B. HORFILLA"}	2026-09-16 13:13:47.619
118	DELETE	tasks	OT-2026-00002	12	{"name": "EUGENE B. HORFILLA"}	2026-09-16 13:14:14.149
119	LOGOUT	auth	Successful Logout	12	{"name": "EUGENE B. HORFILLA"}	2026-09-16 13:19:33.674
120	LOGIN	auth	Successful Login	12	{"name": "EUGENE B. HORFILLA", "username": "ebhorfilla"}	2026-09-16 13:20:19.163
121	LOGOUT	auth	Successful Logout	12	{"name": "EUGENE B. HORFILLA"}	2026-09-16 13:22:21.915
122	REPORT_EMAIL_SENT	REPORT	2026-09-16 to 2026-09-16	12	{"user": "EUGENE B. HORFILLA", "sender": "mreugene2005@gmail.com", "status": "all", "activity": "all", "filename": "OpsLog_Report_2026-09-16_to_2026-09-16.xlsx", "recipients": "ebhorfilla@gmanetwork.com; prramos@gmanetwork.com"}	2026-09-16 13:24:19.47
123	LOGOUT	auth	Successful Logout	12	{"name": "EUGENE B. HORFILLA"}	2026-09-16 13:25:00.225
124	LOGIN	auth	Successful Login	12	{"name": "EUGENE B. HORFILLA", "username": "ebhorfilla"}	2026-09-17 06:19:17.345
125	REPORT_EMAIL_SENT	REPORT	2026-09-16 to 2026-09-17	12	{"user": "EUGENE B. HORFILLA", "sender": "mreugene2005@gmail.com", "status": "all", "activity": "all", "filename": "OpsLog_Report_2026-09-16_to_2026-09-17.xlsx", "recipients": "ebhorfilla@gmanetwork.com"}	2026-09-17 06:21:24.228
126	REPORT_EMAIL_SENT	REPORT	2026-09-01 to 2026-09-17	12	{"user": "EUGENE B. HORFILLA", "sender": "mreugene2005@gmail.com", "status": "all", "activity": "all", "filename": "OpsLog_Report_2026-09-01_to_2026-09-17.xlsx", "recipients": "mreugene2005@gmail.com"}	2026-09-17 07:36:53.022
127	UPDATE_PROFILE	User Profile	Updated ebhorfilla	12	{"user": "EUGENE B. HORFILLA", "changedFields": ["firstName", "surname", "email", "username", "avatarUrl", "smtpEmail", "smtpRecipients", "smtpEnabled", "middleInitial"], "passwordChanged": false, "smtpPasswordChanged": false}	2026-09-17 07:49:04.211
128	UPDATE_PROFILE	User Profile	Updated ebhorfilla	12	{"user": "EUGENE B. HORFILLA", "changedFields": ["firstName", "surname", "email", "username", "avatarUrl", "smtpEmail", "smtpRecipients", "smtpEnabled", "middleInitial"], "passwordChanged": false, "smtpPasswordChanged": false}	2026-09-17 07:49:23.437
129	BACKUP	System	Backup Downloaded	12	{"user": "EUGENE B. HORFILLA", "tasks": 8, "users": 13, "assistance": 9}	2026-09-17 08:21:15.655
130	RESTORE	System	Full Restore (Merge)	12	{"mode": "merge", "user": "EUGENE B. HORFILLA", "auditAdded": 0, "tasksAdded": 0, "usersAdded": 0, "masterAdded": 0, "assistanceAdded": 0}	2026-09-17 08:21:41.986
131	LOGIN	auth	Successful Login	12	{"name": "EUGENE B. HORFILLA", "username": "ebhorfilla"}	2026-09-17 11:41:24.106
132	UPDATE_PROFILE	User Profile	Updated ebhorfilla	12	{"user": "EUGENE B. HORFILLA", "changedFields": ["firstName", "surname", "email", "username", "avatarUrl", "smtpEmail", "smtpRecipients", "smtpEnabled", "middleInitial"], "passwordChanged": false, "smtpPasswordChanged": false}	2026-09-17 11:43:42.84
133	REPORT_EMAIL_SENT	REPORT	2026-09-16 to 2026-09-16	12	{"user": "EUGENE B. HORFILLA", "sender": "mreugene2005@gmail.com", "status": "all", "activity": "all", "filename": "OpsLog_Report_2026-09-16_to_2026-09-16.xlsx", "recipients": "ebhorfilla@gmanetwork.com; jvdumlao@gmanetwork.com"}	2026-09-17 11:44:08.053
134	LOGIN	auth	Successful Login	12	{"name": "EUGENE B. HORFILLA", "username": "ebhorfilla"}	2026-09-18 09:22:52.542
135	LOGOUT	auth	Successful Logout	12	{"name": "EUGENE B. HORFILLA"}	2026-09-18 12:11:38.177
136	LOGIN	auth	Successful Login	12	{"name": "EUGENE B. HORFILLA", "username": "ebhorfilla"}	2026-09-18 12:53:14.153
137	LOGOUT	auth	Successful Logout	12	{"name": "EUGENE B. HORFILLA"}	2026-09-18 12:56:40.545
138	LOGIN	auth	Successful Login	12	{"name": "EUGENE B. HORFILLA", "username": "ebhorfilla"}	2026-09-18 13:13:53.038
139	LOGIN_FAILED	auth	Invalid Username or Password	\N	{"username": "postmams"}	2026-09-19 06:36:23.438
140	LOGIN	auth	Successful Login	12	{"name": "EUGENE B. HORFILLA", "username": "ebhorfilla"}	2026-09-22 04:31:05.609
141	LOGIN	auth	Successful Login	12	{"name": "EUGENE B. HORFILLA", "username": "ebhorfilla"}	2026-09-22 05:34:07.698
142	LOGOUT	auth	Successful Logout	12	{"name": "EUGENE B. HORFILLA"}	2026-09-22 05:36:23.615
143	CREATE	assistance	TA-2026-00012	12	{"name": "EUGENE B. HORFILLA"}	2026-09-22 06:16:15.412
144	CREATE	tasks	OT-2026-00010	12	{"name": "EUGENE B. HORFILLA"}	2026-09-22 06:25:54.132
145	MASTERDATA_ADD	LOCATION	Premiere-LF-03	12	{"name": "EUGENE B. HORFILLA", "value": "Premiere-LF-03"}	2026-09-22 06:32:56.306
146	MASTERDATA_ADD	SHIFT	7AM - 3PM	12	{"name": "EUGENE B. HORFILLA", "value": "7AM - 3PM"}	2026-09-22 06:33:33.51
147	MASTERDATA_ADD	SHOW_GROUP	MAGPAKAILANMAN	12	{"name": "EUGENE B. HORFILLA", "value": "MAGPAKAILANMAN"}	2026-09-22 06:33:48.742
148	MASTERDATA_ADD	CATEGORY	Ingesting	12	{"name": "EUGENE B. HORFILLA", "value": "Ingesting"}	2026-09-22 06:34:56.037
149	REPORT_EMAIL_SENT	REPORT	2026-09-22 to 2026-09-22	12	{"user": "EUGENE B. HORFILLA", "sender": "mreugene2005@gmail.com", "status": "all", "activity": "all", "filename": "OpsLog_Report_2026-09-22_to_2026-09-22.xlsx", "recipients": "ebhorfilla@gmanetwork.com; jvdumlao@gmanetwork.com"}	2026-09-22 07:00:02.025
150	UPDATE_PROFILE	User Profile	Updated ebhorfilla	12	{"user": "EUGENE B. HORFILLA", "changedFields": ["firstName", "surname", "email", "username", "avatarUrl", "smtpEmail", "smtpRecipients", "smtpEnabled", "middleInitial"], "passwordChanged": false, "smtpPasswordChanged": false}	2026-09-22 07:00:15.812
151	REPORT_EMAIL_SENT	REPORT	2026-09-22 to 2026-09-22	12	{"user": "EUGENE B. HORFILLA", "sender": "mreugene2005@gmail.com", "status": "all", "activity": "all", "filename": "OpsLog_Report_2026-09-22_to_2026-09-22.xlsx", "recipients": "ebhorfilla@gmanetwork.com"}	2026-09-22 07:11:23.187
152	REPORT_EMAIL_SENT	REPORT	2026-09-22 to 2026-09-22	12	{"user": "EUGENE B. HORFILLA", "sender": "mreugene2005@gmail.com", "status": "all", "activity": "all", "filename": "OpsLog_Report_2026-09-22_to_2026-09-22.xlsx", "recipients": "ebhorfilla@gmanetwork.com"}	2026-09-22 07:32:55.682
153	REPORT_EMAIL_SENT	REPORT	2026-09-22 to 2026-09-22	12	{"user": "EUGENE B. HORFILLA", "sender": "mreugene2005@gmail.com", "status": "all", "activity": "all", "filename": "OpsLog_Report_2026-09-22_to_2026-09-22.xlsx", "recipients": "ebhorfilla@gmanetwork.com"}	2026-09-22 07:33:50.875
154	REPORT_EMAIL_SENT	REPORT	2026-09-01 to 2026-09-22	12	{"user": "EUGENE B. HORFILLA", "sender": "mreugene2005@gmail.com", "status": "all", "activity": "all", "filename": "OpsLog_Report_2026-09-01_to_2026-09-22.xlsx", "recipients": "ebhorfilla@gmanetwork.com"}	2026-09-22 08:04:35.38
155	REPORT_EMAIL_SENT	REPORT	2026-09-01 to 2026-09-22	12	{"user": "EUGENE B. HORFILLA", "sender": "mreugene2005@gmail.com", "status": "all", "activity": "all", "filename": "OpsLog_Report_2026-09-01_to_2026-09-22.xlsx", "recipients": "ebhorfilla@gmanetwork.com"}	2026-09-22 08:14:12.844
156	REPORT_EMAIL_SENT	REPORT	2026-09-01 to 2026-09-22	12	{"user": "EUGENE B. HORFILLA", "sender": "mreugene2005@gmail.com", "status": "all", "activity": "all", "filename": "OpsLog_Report_2026-09-01_to_2026-09-22.xlsx", "recipients": "ebhorfilla@gmanetwork.com"}	2026-09-22 08:34:15.102
157	LOGIN	auth	Successful Login	12	{"name": "EUGENE B. HORFILLA", "username": "ebhorfilla"}	2026-09-22 08:40:42.178
158	LOGOUT	auth	Successful Logout	12	{"name": "EUGENE B. HORFILLA"}	2026-09-22 08:51:03.544
159	LOGIN_FAILED	auth	Invalid Username or Password	\N	{"username": "postmams"}	2026-09-22 08:51:05.942
160	LOGIN_FAILED	auth	Invalid Username or Password	\N	{"username": "postmams"}	2026-09-22 08:51:09.733
161	LOGIN_FAILED	auth	Invalid Username or Password	\N	{"username": "postmams"}	2026-09-22 08:51:15.19
162	LOGIN	auth	Successful Login	12	{"name": "EUGENE B. HORFILLA", "username": "ebhorfilla"}	2026-09-22 08:51:31.728
163	LOGOUT	auth	Successful Logout	12	{"name": "EUGENE B. HORFILLA"}	2026-09-22 08:54:41.573
164	LOGIN_FAILED	auth	Invalid Username or Password	\N	{"username": "ebhorfillla"}	2026-09-22 08:58:37.93
165	LOGIN_FAILED	auth	Invalid Username or Password	\N	{"username": "ebhorfillla"}	2026-09-22 08:58:44.329
166	LOGIN_FAILED	auth	Invalid Username or Password	\N	{"username": "ebhorfillla"}	2026-09-22 08:58:49.124
167	LOGIN	auth	Successful Login	12	{"name": "EUGENE B. HORFILLA", "username": "ebhorfilla"}	2026-09-22 08:59:04.134
168	LOGOUT	auth	Successful Logout	12	{"name": "EUGENE B. HORFILLA"}	2026-09-22 08:59:11.7
169	LOGIN	auth	Successful Login	12	{"name": "EUGENE B. HORFILLA", "username": "ebhorfilla"}	2026-09-22 09:01:08.369
170	UPDATE_PROFILE	User Profile	Updated ebhorfilla	12	{"user": "EUGENE B. HORFILLA", "changedFields": ["firstName", "surname", "email", "username", "avatarUrl", "smtpEmail", "smtpRecipients", "smtpEnabled", "middleInitial"], "passwordChanged": false, "smtpPasswordChanged": false}	2026-09-22 09:02:28.1
171	REPORT_EMAIL_SENT	REPORT	2026-09-01 to 2026-09-22	12	{"user": "EUGENE B. HORFILLA", "sender": "mreugene2005@gmail.com", "status": "all", "activity": "all", "filename": "OpsLog_Report_2026-09-01_to_2026-09-22.xlsx", "recipients": "ebhorfilla@gmanetwork.com; avvillaceran@gmanetwork.com"}	2026-09-22 09:02:45.79
172	UPDATE	assistance	TA-2026-00012	12	{"name": "EUGENE B. HORFILLA", "recordId": 12}	2026-09-22 09:07:19.999
173	UPDATE_PROFILE	User Profile	Updated ebhorfilla	12	{"user": "EUGENE B. HORFILLA", "changedFields": ["firstName", "surname", "email", "username", "avatarUrl", "smtpEmail", "smtpRecipients", "smtpEnabled", "middleInitial"], "passwordChanged": false, "smtpPasswordChanged": false}	2026-09-22 09:09:23.386
174	LOCK	assistance	TA-2026-00003	12	{"name": "EUGENE B. HORFILLA"}	2026-09-22 09:09:56.477
175	UNLOCK	assistance	TA-2026-00003	12	{"name": "EUGENE B. HORFILLA"}	2026-09-22 09:09:58.215
176	LOCK	assistance	TA-2026-00003	12	{"name": "EUGENE B. HORFILLA"}	2026-09-22 09:09:59.241
177	UNLOCK	assistance	TA-2026-00003	12	{"name": "EUGENE B. HORFILLA"}	2026-09-22 09:10:01.177
178	UPDATE	assistance	TA-2026-00003	12	{"name": "EUGENE B. HORFILLA", "recordId": 3}	2026-09-22 09:10:30.015
179	LOGOUT	auth	Successful Logout	12	{"name": "EUGENE B. HORFILLA"}	2026-09-22 09:12:38.925
180	CREATE	tasks	OT-2026-00011	12	{"name": "EUGENE B. HORFILLA"}	2026-09-22 09:32:12.676
181	DELETE	tasks	OT-2026-00011	12	{"name": "EUGENE B. HORFILLA"}	2026-09-22 10:08:17.152
182	CREATE	tasks	OT-2026-00012	12	{"name": "EUGENE B. HORFILLA"}	2026-09-22 10:08:35.046
183	UPDATE	tasks	OT-2026-00012	12	{"name": "EUGENE B. HORFILLA", "recordId": 12}	2026-09-22 10:14:23.062
184	CREATE	assistance	TA-2026-00013	12	{"name": "EUGENE B. HORFILLA"}	2026-09-22 10:20:49.463
185	UPDATE	assistance	TA-2026-00013	12	{"name": "EUGENE B. HORFILLA", "recordId": 13}	2026-09-22 10:23:06.844
186	CREATE	tasks	OT-2026-00013	12	{"name": "EUGENE B. HORFILLA"}	2026-09-22 10:30:36.708
187	UPDATE	tasks	OT-2026-00013	12	{"name": "EUGENE B. HORFILLA", "recordId": 13}	2026-09-22 10:37:11.752
188	UPDATE	tasks	OT-2026-00013	12	{"name": "EUGENE B. HORFILLA", "recordId": 13}	2026-09-22 10:40:44.613
189	UPDATE	tasks	OT-2026-00013	12	{"name": "EUGENE B. HORFILLA", "recordId": 13}	2026-09-22 10:44:28.959
190	UPDATE	tasks	OT-2026-00013	12	{"name": "EUGENE B. HORFILLA", "recordId": 13}	2026-09-22 11:52:38.091
191	LOCK	tasks	OT-2026-00013	12	{"name": "EUGENE B. HORFILLA"}	2026-09-22 12:12:53.927
192	UNLOCK	tasks	OT-2026-00013	12	{"name": "EUGENE B. HORFILLA"}	2026-09-22 12:12:57.063
193	UPDATE	tasks	OT-2026-00013	12	{"name": "EUGENE B. HORFILLA", "recordId": 13}	2026-09-22 12:31:43.15
194	UPDATE	tasks	OT-2026-00013	12	{"name": "EUGENE B. HORFILLA", "recordId": 13}	2026-09-22 12:32:18.846
195	UPDATE	tasks	OT-2026-00013	12	{"name": "EUGENE B. HORFILLA", "recordId": 13}	2026-09-22 12:32:23.468
196	UPDATE	tasks	OT-2026-00013	12	{"name": "EUGENE B. HORFILLA", "recordId": 13}	2026-09-22 12:32:25.227
197	UPDATE	tasks	OT-2026-00013	12	{"name": "EUGENE B. HORFILLA", "recordId": 13}	2026-09-22 12:37:52.26
198	UPDATE	tasks	OT-2026-00013	12	{"name": "EUGENE B. HORFILLA", "recordId": 13}	2026-09-22 12:37:58.159
199	UPDATE	tasks	OT-2026-00013	12	{"name": "EUGENE B. HORFILLA", "recordId": 13}	2026-09-22 12:38:10.775
200	CREATE	assistance	TA-2026-00014	12	{"name": "EUGENE B. HORFILLA"}	2026-09-22 12:38:31.142
201	UPDATE	assistance	TA-2026-00013	12	{"name": "EUGENE B. HORFILLA", "recordId": 13}	2026-09-22 12:39:19.483
202	UPDATE	assistance	TA-2026-00013	12	{"name": "EUGENE B. HORFILLA", "recordId": 13}	2026-09-22 12:39:29.751
203	UPDATE	assistance	TA-2026-00014	12	{"name": "EUGENE B. HORFILLA", "recordId": 14}	2026-09-22 12:49:10.349
204	UPDATE	assistance	TA-2026-00014	12	{"name": "EUGENE B. HORFILLA", "recordId": 14}	2026-09-22 12:49:13.096
205	UPDATE	assistance	TA-2026-00014	12	{"name": "EUGENE B. HORFILLA", "recordId": 14}	2026-09-22 12:49:17.762
206	UPDATE	assistance	TA-2026-00014	12	{"name": "EUGENE B. HORFILLA", "recordId": 14}	2026-09-22 12:56:24.05
207	CREATE	tasks	OT-2026-00014	12	{"name": "EUGENE B. HORFILLA"}	2026-09-22 12:56:42.256
208	UPDATE	tasks	OT-2026-00013	12	{"name": "EUGENE B. HORFILLA", "recordId": 13}	2026-09-22 12:57:01.75
209	LOCK	tasks	OT-2026-00014	12	{"name": "EUGENE B. HORFILLA"}	2026-09-22 12:59:17.949
210	UNLOCK	tasks	OT-2026-00014	12	{"name": "EUGENE B. HORFILLA"}	2026-09-22 12:59:21.11
211	LOCK	tasks	OT-2026-00014	12	{"name": "EUGENE B. HORFILLA"}	2026-09-22 12:59:22.511
212	UPDATE	tasks	OT-2026-00014	12	{"name": "EUGENE B. HORFILLA", "recordId": 14}	2026-09-22 12:59:34.449
213	UNLOCK	tasks	OT-2026-00014	12	{"name": "EUGENE B. HORFILLA"}	2026-09-22 12:59:41.231
214	DELETE	tasks	OT-2026-00014	12	{"name": "EUGENE B. HORFILLA"}	2026-09-22 12:59:49.886
215	LOGIN	auth	Successful Login	12	{"name": "EUGENE B. HORFILLA", "username": "ebhorfilla"}	2026-09-23 04:09:57.702
216	LOCK	assistance	TA-2026-00014	12	{"name": "EUGENE B. HORFILLA"}	2026-09-23 04:22:28.245
217	UPDATE_USER	User Profile	Updated testuser	12	{"user": "Test T. User", "changedFields": ["firstName", "surname", "email", "username", "avatarUrl", "smtpEmail", "smtpRecipients", "smtpEnabled", "smtpPassword", "middleInitial", "role"], "passwordChanged": false, "smtpPasswordChanged": true}	2026-09-23 04:24:53.04
218	UPDATE_USER	User Profile	Updated testuser	12	{"user": "Test T. User", "changedFields": ["firstName", "surname", "email", "username", "avatarUrl", "smtpEmail", "smtpRecipients", "smtpEnabled", "middleInitial", "password", "role"], "passwordChanged": true, "smtpPasswordChanged": false}	2026-09-23 04:25:13.981
219	LOGOUT	auth	Successful Logout	12	{"name": "EUGENE B. HORFILLA"}	2026-09-23 04:25:26.652
220	LOGIN	auth	Successful Login	8	{"name": "Test T. User", "username": "testuser"}	2026-09-23 04:25:29.516
221	CREATE	assistance	TA-2026-00015	8	{"name": "Test T. User"}	2026-09-23 04:28:02.74
222	UPDATE	assistance	TA-2026-00015	8	{"name": "Test T. User", "recordId": 15}	2026-09-23 04:28:19.548
223	LOGOUT	auth	Successful Logout	8	{"name": "Test T. User"}	2026-09-23 04:28:29.189
224	LOGIN	auth	Successful Login	12	{"name": "EUGENE B. HORFILLA", "username": "ebhorfilla"}	2026-09-23 04:28:33.488
225	LOCK	assistance	TA-2026-00015	12	{"name": "EUGENE B. HORFILLA"}	2026-09-23 04:28:37.692
226	LOGOUT	auth	Successful Logout	12	{"name": "EUGENE B. HORFILLA"}	2026-09-23 04:28:41.664
227	LOGIN	auth	Successful Login	8	{"name": "Test T. User", "username": "testuser"}	2026-09-23 04:28:44.325
228	LOGOUT	auth	Successful Logout	8	{"name": "Test T. User"}	2026-09-23 04:29:17.532
229	LOGIN_FAILED	auth	Invalid Username or Password	\N	{"username": "postmams"}	2026-09-23 04:29:21.853
230	LOGIN	auth	Successful Login	12	{"name": "EUGENE B. HORFILLA", "username": "ebhorfilla"}	2026-09-23 04:29:24.856
231	UNLOCK	assistance	TA-2026-00015	12	{"name": "EUGENE B. HORFILLA"}	2026-09-23 04:29:29.572
232	LOGOUT	auth	Successful Logout	12	{"name": "EUGENE B. HORFILLA"}	2026-09-23 04:29:31.575
233	LOGIN	auth	Successful Login	8	{"name": "Test T. User", "username": "testuser"}	2026-09-23 04:29:34.064
234	LOGOUT	auth	Successful Logout	8	{"name": "Test T. User"}	2026-09-23 05:45:04.491
235	LOGIN	auth	Successful Login	12	{"name": "EUGENE B. HORFILLA", "username": "ebhorfilla"}	2026-09-23 05:45:07.461
236	LOGOUT	auth	Successful Logout	12	{"name": "EUGENE B. HORFILLA"}	2026-09-23 06:10:50.368
237	LOGIN	auth	Successful Login	8	{"name": "Test T. User", "username": "testuser"}	2026-09-23 06:10:53.667
238	LOGOUT	auth	Successful Logout	8	{"name": "Test T. User"}	2026-09-23 06:49:47.181
239	LOGIN	auth	Successful Login	12	{"name": "EUGENE B. HORFILLA", "username": "ebhorfilla"}	2026-09-23 06:49:51.27
240	LOGOUT	auth	Successful Logout	12	{"name": "EUGENE B. HORFILLA"}	2026-09-23 07:28:46.253
241	LOGIN	auth	Successful Login	8	{"name": "Test T. User", "username": "testuser"}	2026-09-23 07:28:49.321
242	LOGOUT	auth	Successful Logout	8	{"name": "Test T. User"}	2026-09-23 07:35:02.09
243	LOGIN	auth	Successful Login	12	{"name": "EUGENE B. HORFILLA", "username": "ebhorfilla"}	2026-09-23 07:35:06.145
244	LOGOUT	auth	Successful Logout	12	{"name": "EUGENE B. HORFILLA"}	2026-09-23 07:35:37.959
245	LOGIN	auth	Successful Login	8	{"name": "Test T. User", "username": "testuser"}	2026-09-23 07:35:41.17
246	LOGOUT	auth	Successful Logout	8	{"name": "Test T. User"}	2026-09-23 07:37:21.209
247	LOGIN_FAILED	auth	Invalid Username or Password	\N	{"username": "postmams"}	2026-09-23 07:37:23.898
248	LOGIN	auth	Successful Login	12	{"name": "EUGENE B. HORFILLA", "username": "ebhorfilla"}	2026-09-23 07:37:26.204
249	UPDATE_USER	User Profile	Updated testuser	12	{"user": "Test T. User", "changedFields": ["firstName", "surname", "email", "username", "avatarUrl", "smtpEmail", "smtpRecipients", "smtpEnabled", "middleInitial", "role"], "passwordChanged": false, "smtpPasswordChanged": false}	2026-09-23 07:37:46.613
250	UPDATE_USER	User Profile	Updated testuser	12	{"user": "Test T. User", "changedFields": ["firstName", "surname", "email", "username", "avatarUrl", "smtpEmail", "smtpRecipients", "smtpEnabled", "middleInitial", "role"], "passwordChanged": false, "smtpPasswordChanged": false}	2026-09-23 07:37:57.053
251	UPDATE_USER	User Profile	Updated testuser	12	{"user": "Test T. User", "changedFields": ["firstName", "surname", "email", "username", "avatarUrl", "smtpEmail", "smtpRecipients", "smtpEnabled", "middleInitial", "role"], "passwordChanged": false, "smtpPasswordChanged": false}	2026-09-23 07:38:04.973
252	UPDATE_USER	User Profile	Updated testuser	12	{"user": "Test T. User", "changedFields": ["firstName", "surname", "email", "username", "avatarUrl", "smtpEmail", "smtpRecipients", "smtpEnabled", "middleInitial", "role"], "passwordChanged": false, "smtpPasswordChanged": false}	2026-09-23 07:38:47.217
253	LOGOUT	auth	Successful Logout	12	{"name": "EUGENE B. HORFILLA"}	2026-09-23 07:39:27.328
254	LOGIN	auth	Successful Login	8	{"name": "Test T. User", "username": "testuser"}	2026-09-23 07:39:31.962
255	UPDATE_PROFILE	User Profile	Updated testuser	8	{"user": "Test T. User", "changedFields": ["firstName", "middleInitial", "surname", "email", "username", "avatarUrl", "smtpEnabled", "smtpEmail", "smtpRecipients"], "passwordChanged": false, "smtpPasswordChanged": false}	2026-09-23 08:00:49.977
256	UPDATE_PROFILE	User Profile	Updated testuser	8	{"user": "Test T. User", "changedFields": ["firstName", "middleInitial", "surname", "email", "username", "avatarUrl", "smtpEnabled", "smtpEmail", "smtpRecipients"], "passwordChanged": false, "smtpPasswordChanged": false}	2026-09-23 08:01:14.291
257	LOGOUT	auth	Successful Logout	8	{"name": "Test T. User"}	2026-09-23 08:02:16.604
258	LOGIN_FAILED	auth	Invalid Username or Password	\N	{"username": "postmams"}	2026-09-23 08:02:19.086
259	LOGIN	auth	Successful Login	12	{"name": "EUGENE B. HORFILLA", "username": "ebhorfilla"}	2026-09-23 08:02:22.263
260	UPDATE_PROFILE	User Profile	Updated ebhorfilla	12	{"user": "EUGENE B. HORFILLA", "changedFields": ["firstName", "middleInitial", "surname", "email", "username", "avatarUrl", "smtpEnabled", "smtpEmail", "smtpRecipients"], "passwordChanged": false, "smtpPasswordChanged": false}	2026-09-23 08:03:05.669
261	UPDATE_PROFILE	User Profile	Updated ebhorfilla	12	{"user": "EUGENE B. HORFILLA", "changedFields": ["firstName", "middleInitial", "surname", "email", "username", "avatarUrl", "smtpEnabled", "smtpEmail", "smtpRecipients"], "passwordChanged": false, "smtpPasswordChanged": false}	2026-09-23 08:03:29.933
262	UPDATE_USER	User Profile	Updated testuser	12	{"user": "Test T. User", "changedFields": ["firstName", "surname", "email", "username", "avatarUrl", "smtpEmail", "smtpRecipients", "smtpEnabled", "middleInitial", "role"], "passwordChanged": false, "smtpPasswordChanged": false}	2026-09-23 08:03:55.34
263	UPDATE_USER	User Profile	Updated testuser	12	{"targetUser": "Test T. User", "changedFields": ["firstName", "surname", "email", "username", "avatarUrl", "smtpEmail", "smtpRecipients", "smtpEnabled", "middleInitial", "role"], "targetUsername": "testuser", "passwordChanged": false, "smtpPasswordChanged": false}	2026-09-23 08:10:20.148
264	UPDATE_USER	User Profile	Updated testuser	12	{"actor": "EUGENE B. HORFILLA", "targetUser": "Test T. User", "changedFields": ["firstName", "surname", "email", "username", "avatarUrl", "smtpEmail", "smtpRecipients", "smtpEnabled", "middleInitial", "role"], "targetUsername": "testuser", "passwordChanged": false, "smtpPasswordChanged": false}	2026-09-23 08:18:09.496
265	LOGOUT	auth	Successful Logout	12	{"name": "EUGENE B. HORFILLA"}	2026-09-23 08:18:58.245
266	LOGIN	auth	Successful Login	12	{"name": "EUGENE B. HORFILLA", "username": "ebhorfilla"}	2026-09-23 08:19:05.093
267	LOGOUT	auth	Successful Logout	12	{"name": "EUGENE B. HORFILLA"}	2026-09-23 08:19:14.58
268	LOGIN	auth	Successful Login	8	{"name": "Test T. User", "username": "testuser"}	2026-09-23 08:19:18.216
269	UPDATE_PROFILE	User Profile	Updated testuser	8	{"user": "Test T. User", "changedFields": ["firstName", "middleInitial", "surname", "email", "username", "avatarUrl", "smtpEnabled", "smtpEmail", "smtpRecipients"], "passwordChanged": false, "smtpPasswordChanged": false}	2026-09-23 08:19:24.873
270	CREATE	assistance	TA-2026-00016	8	{"name": "Test T. User"}	2026-09-23 08:21:40.594
271	CREATE	tasks	OT-2026-00015	8	{"name": "Test T. User"}	2026-09-23 08:23:24.343
272	LOGOUT	auth	Successful Logout	8	{"name": "Test T. User"}	2026-09-23 09:06:45.871
273	LOGIN	auth	Successful Login	12	{"name": "EUGENE B. HORFILLA", "username": "ebhorfilla"}	2026-09-23 09:06:48.584
274	LOGOUT	auth	Successful Logout	12	{"name": "EUGENE B. HORFILLA"}	2026-09-23 09:20:50.643
275	LOGIN	auth	Successful Login	8	{"name": "Test T. User", "username": "testuser"}	2026-09-23 09:20:54.389
276	LOGOUT	auth	Successful Logout	8	{"name": "Test T. User"}	2026-09-23 09:24:34.829
277	LOGIN	auth	Successful Login	12	{"name": "EUGENE B. HORFILLA", "username": "ebhorfilla"}	2026-09-23 09:24:38.792
278	UPDATE_USER	User Profile	Updated testuser2	12	{"actor": "EUGENE B. HORFILLA", "targetUser": "Test 2. User", "changedFields": ["firstName", "surname", "email", "username", "avatarUrl", "smtpEmail", "smtpRecipients", "smtpEnabled", "smtpPassword", "middleInitial", "role"], "targetUsername": "testuser2", "passwordChanged": false, "smtpPasswordChanged": true}	2026-09-23 09:26:02.592
279	LOGOUT	auth	Successful Logout	12	{"name": "EUGENE B. HORFILLA"}	2026-09-23 09:26:08.408
280	LOGIN	auth	Successful Login	12	{"name": "EUGENE B. HORFILLA", "username": "ebhorfilla"}	2026-09-23 09:26:17.609
281	UPDATE_USER	User Profile	Updated testuser2	12	{"actor": "EUGENE B. HORFILLA", "targetUser": "Test 2. User", "changedFields": ["firstName", "surname", "email", "username", "avatarUrl", "smtpEmail", "smtpRecipients", "smtpEnabled", "middleInitial", "password", "role"], "targetUsername": "testuser2", "passwordChanged": true, "smtpPasswordChanged": false}	2026-09-23 09:26:28.978
282	LOGOUT	auth	Successful Logout	12	{"name": "EUGENE B. HORFILLA"}	2026-09-23 09:26:31.64
283	LOGIN	auth	Successful Login	4	{"name": "Test 2. User", "username": "testuser2"}	2026-09-23 09:26:38.942
284	CREATE	assistance	TA-2026-00017	4	{"name": "Test 2. User"}	2026-09-23 09:28:39.971
285	LOGOUT	auth	Successful Logout	4	{"name": "Test 2. User"}	2026-09-23 09:48:47.23
286	LOGIN	auth	Successful Login	12	{"name": "EUGENE B. HORFILLA", "username": "ebhorfilla"}	2026-09-23 09:48:52.288
287	LOGOUT	auth	Successful Logout	12	{"name": "EUGENE B. HORFILLA"}	2026-09-23 10:12:33.001
288	LOGIN	auth	Successful Login	4	{"name": "Test 2. User", "username": "testuser2"}	2026-09-23 10:12:36.422
289	LOGOUT	auth	Successful Logout	4	{"name": "Test 2. User"}	2026-09-23 10:13:11.751
290	LOGIN	auth	Successful Login	12	{"name": "EUGENE B. HORFILLA", "username": "ebhorfilla"}	2026-09-23 10:13:15.461
291	LOGOUT	auth	Successful Logout	12	{"name": "EUGENE B. HORFILLA"}	2026-09-23 10:21:16.617
292	LOGIN	auth	Successful Login	8	{"name": "Test T. User", "username": "testuser"}	2026-09-23 10:21:20.449
293	LOGOUT	auth	Successful Logout	8	{"name": "Test T. User"}	2026-09-23 11:20:03.148
294	LOGIN	auth	Successful Login	4	{"name": "Test 2. User", "username": "testuser2"}	2026-09-23 11:20:13.026
295	LOGOUT	auth	Successful Logout	4	{"name": "Test 2. User"}	2026-09-23 11:51:57.225
296	LOGIN	auth	Successful Login	4	{"name": "Test 2. User", "username": "testuser2"}	2026-09-23 11:52:02.563
297	LOGOUT	auth	Successful Logout	4	{"name": "Test 2. User"}	2026-09-23 11:52:07.537
298	LOGIN	auth	Successful Login	8	{"name": "Test T. User", "username": "testuser"}	2026-09-23 11:52:11.135
348	LOGOUT	auth	Successful Logout	4	{"name": "Test 2. User"}	2026-09-24 06:50:02.287
349	LOGIN	auth	Successful Login	12	{"name": "EUGENE B. HORFILLA", "username": "ebhorfilla"}	2026-09-24 06:50:05.103
299	UPDATE_PROFILE	User Profile	Updated testuser	8	{"user": "Test T. User", "changedFields": ["firstName", "middleInitial", "surname", "email", "username", "avatarUrl", "smtpEnabled", "smtpEmail", "smtpRecipients", "password"], "passwordChanged": true, "smtpPasswordChanged": false}	2026-09-23 12:12:57.138
300	LOGOUT	auth	Successful Logout	8	{"name": "Test T. User"}	2026-09-23 12:12:59.558
301	LOGIN	auth	Successful Login	8	{"name": "Test T. User", "username": "testuser"}	2026-09-23 12:13:09.729
302	LOGOUT	auth	Successful Logout	8	{"name": "Test T. User"}	2026-09-23 12:13:30.07
303	LOGIN	auth	Successful Login	4	{"name": "Test 2. User", "username": "testuser2"}	2026-09-23 12:13:32.527
304	LOGOUT	auth	Successful Logout	4	{"name": "Test 2. User"}	2026-09-23 12:13:38.196
305	LOGIN	auth	Successful Login	12	{"name": "EUGENE B. HORFILLA", "username": "ebhorfilla"}	2026-09-23 12:13:41.743
306	LOGIN	auth	Successful Login	8	{"name": "Test T. User", "username": "testuser"}	2026-09-23 12:16:06.601
307	LOGOUT	auth	Successful Logout	8	{"name": "Test T. User"}	2026-09-23 12:24:13.419
308	LOGIN_FAILED	auth	Invalid Username or Password	\N	{"username": "testuser1"}	2026-09-23 12:24:45.268
309	LOGIN_FAILED	auth	Invalid Username or Password	\N	{"username": "testuser1"}	2026-09-23 12:24:54.544
310	LOGIN	auth	Successful Login	8	{"name": "Test T. User", "username": "testuser"}	2026-09-23 12:24:59.115
311	LOGOUT	auth	Successful Logout	8	{"name": "Test T. User"}	2026-09-23 12:25:05.192
312	LOGIN	auth	Successful Login	12	{"name": "EUGENE B. HORFILLA", "username": "ebhorfilla"}	2026-09-23 12:25:13.61
313	LOGOUT	auth	Successful Logout	12	{"name": "EUGENE B. HORFILLA"}	2026-09-23 12:27:20.871
314	LOGOUT	auth	Successful Logout	12	{"name": "EUGENE B. HORFILLA"}	2026-09-23 12:45:19.451
315	LOGIN	auth	Successful Login	12	{"name": "EUGENE B. HORFILLA", "username": "ebhorfilla"}	2026-09-23 12:48:33.736
316	LOGOUT	auth	Successful Logout	12	{"name": "EUGENE B. HORFILLA"}	2026-09-23 13:03:32.504
317	LOGIN	auth	Successful Login	12	{"name": "EUGENE B. HORFILLA", "username": "ebhorfilla"}	2026-09-23 13:03:38.744
318	LOGOUT	auth	Successful Logout	12	{"name": "EUGENE B. HORFILLA"}	2026-09-23 13:04:02.929
319	LOGIN	auth	Successful Login	4	{"name": "Test 2. User", "username": "testuser2"}	2026-09-24 03:50:10.587
320	LOGOUT	auth	Successful Logout	4	{"name": "Test 2. User"}	2026-09-24 03:51:38.094
321	LOGIN	auth	Successful Login	12	{"name": "EUGENE B. HORFILLA", "username": "ebhorfilla"}	2026-09-24 03:51:40.953
322	LOGOUT	auth	Successful Logout	12	{"name": "EUGENE B. HORFILLA"}	2026-09-24 04:33:05.73
323	LOGIN	auth	Successful Login	8	{"name": "Test T. User", "username": "testuser"}	2026-09-24 04:33:09.674
324	LOGOUT	auth	Successful Logout	8	{"name": "Test T. User"}	2026-09-24 04:39:50.379
325	LOGIN	auth	Successful Login	12	{"name": "EUGENE B. HORFILLA", "username": "ebhorfilla"}	2026-09-24 04:39:53.925
326	LOGOUT	auth	Successful Logout	12	{"name": "EUGENE B. HORFILLA"}	2026-09-24 04:42:32.439
327	LOGIN	auth	Successful Login	8	{"name": "Test T. User", "username": "testuser"}	2026-09-24 04:42:36.377
328	LOGOUT	auth	Successful Logout	8	{"name": "Test T. User"}	2026-09-24 04:43:54.508
329	LOGIN	auth	Successful Login	12	{"name": "EUGENE B. HORFILLA", "username": "ebhorfilla"}	2026-09-24 04:43:58.45
330	IMPORT	Other Tasks	Successfully Imported 1 Records	12	{"user": "EUGENE B. HORFILLA", "scope": "self", "failed": 0, "format": "excel", "filename": "OpsTracker_Import_Template (4).xlsx", "imported": 1, "sheetUsed": "Other Tasks"}	2026-09-24 05:15:54.206
331	IMPORT	Technical Assistance	Successfully Imported 1 Records	12	{"user": "EUGENE B. HORFILLA", "scope": "self", "failed": 0, "format": "excel", "filename": "OpsTracker_Import_Template (4).xlsx", "imported": 1, "sheetUsed": "Technical Assistance"}	2026-09-24 05:16:30.473
332	LOGOUT	auth	Successful Logout	12	{"name": "EUGENE B. HORFILLA"}	2026-09-24 05:16:51.897
333	LOGIN	auth	Successful Login	8	{"name": "Test T. User", "username": "testuser"}	2026-09-24 05:17:15.697
334	IMPORT	Technical Assistance	Successfully Imported 1 Records	8	{"user": "Test T. User", "scope": "self", "failed": 0, "format": "excel", "filename": "OpsTracker_Import_Template (4).xlsx", "imported": 1, "sheetUsed": "Technical Assistance"}	2026-09-24 05:17:38.985
335	IMPORT	Other Tasks	Successfully Imported 1 Records	8	{"user": "Test T. User", "scope": "self", "failed": 0, "format": "excel", "filename": "OpsTracker_Import_Template (4).xlsx", "imported": 1, "sheetUsed": "Other Tasks"}	2026-09-24 05:17:59.1
336	LOGOUT	auth	Successful Logout	8	{"name": "Test T. User"}	2026-09-24 05:18:10.816
337	LOGIN	auth	Successful Login	4	{"name": "Test 2. User", "username": "testuser2"}	2026-09-24 05:18:48.999
338	IMPORT	Technical Assistance	Successfully Imported 1 Records	4	{"user": "Test 2. User", "scope": "self", "failed": 0, "format": "excel", "filename": "OpsTracker_Import_Template (4).xlsx", "imported": 1, "sheetUsed": "Technical Assistance"}	2026-09-24 05:19:17.708
339	IMPORT	Other Tasks	Successfully Imported 1 Records	4	{"user": "Test 2. User", "scope": "self", "failed": 0, "format": "excel", "filename": "OpsTracker_Import_Template (4).xlsx", "imported": 1, "sheetUsed": "Other Tasks"}	2026-09-24 05:19:40.075
340	LOGOUT	auth	Successful Logout	4	{"name": "Test 2. User"}	2026-09-24 05:21:13.065
341	LOGIN	auth	Successful Login	12	{"name": "EUGENE B. HORFILLA", "username": "ebhorfilla"}	2026-09-24 05:21:17.776
342	REPORT_EMAIL_SENT	REPORT	2026-09-01 to 2026-09-24	12	{"user": "EUGENE B. HORFILLA", "sender": "mreugene2005@gmail.com", "status": "all", "activity": "all", "filename": "MAMS_Support_Activity_Report_2026-09-01_to_2026-09-24.xlsx", "recipients": "ebhorfilla@gmanetwork.com"}	2026-09-24 05:48:22.572
343	REPORT_EMAIL_SENT	REPORT	2026-09-01 to 2026-09-24	12	{"user": "EUGENE B. HORFILLA", "sender": "mreugene2005@gmail.com", "status": "all", "activity": "all", "filename": "MAMS_Support_Activity_Report_2026-09-01_to_2026-09-24.xlsx", "recipients": "ebhorfilla@gmanetwork.com"}	2026-09-24 05:54:42.652
344	REPORT_EMAIL_SENT	REPORT	2026-09-01 to 2026-09-24	12	{"user": "EUGENE B. HORFILLA", "sender": "mreugene2005@gmail.com", "status": "all", "activity": "all", "filename": "MAMS_Support_Activity_Report_2026-09-01_to_2026-09-24.xlsx", "recipients": "ebhorfilla@gmanetwork.com"}	2026-09-24 05:57:10.894
345	LOGOUT	auth	Successful Logout	12	{"name": "EUGENE B. HORFILLA"}	2026-09-24 06:00:00.487
346	LOGIN	auth	Successful Login	4	{"name": "Test 2. User", "username": "testuser2"}	2026-09-24 06:00:02.959
347	REPORT_EMAIL_SENT	REPORT	2026-09-01 to 2026-09-24	4	{"user": "Test 2. User", "sender": "mreugene2005@gmail.com", "status": "all", "activity": "all", "filename": "MAMS_Support_Activity_Report_2026-09-01_to_2026-09-24.xlsx", "recipients": "ebhorfilla@gmanetwork.com"}	2026-09-24 06:14:20.925
350	LOGIN_FAILED	auth	Invalid Username or Password	\N	{"username": "testuser1"}	2026-09-24 11:31:05.408
351	LOGIN_FAILED	auth	Invalid Username or Password	\N	{"username": "testuser"}	2026-09-24 11:31:08.431
352	LOGIN	auth	Successful Login	8	{"name": "Test T. User", "username": "testuser"}	2026-09-24 11:31:13.001
353	LOGOUT	auth	Successful Logout	8	{"name": "Test T. User"}	2026-09-24 12:07:28.035
354	LOGIN	auth	Successful Login	12	{"name": "EUGENE B. HORFILLA", "username": "ebhorfilla"}	2026-09-25 03:54:12.399
355	LOGIN_FAILED	auth	Invalid Username or Password	\N	{"username": "testuser"}	2026-09-25 03:57:07.134
356	LOGIN	auth	Successful Login	8	{"name": "Test T. User", "username": "testuser"}	2026-09-25 03:57:09.219
357	LOGOUT	auth	Successful Logout	8	{"name": "Test T. User"}	2026-09-25 04:28:08.066
358	REPORT_EMAIL_SENT	REPORT	2026-09-24 to 2026-09-25	12	{"user": "EUGENE B. HORFILLA", "sender": "mreugene2005@gmail.com", "status": "all", "activity": "all", "filename": "MAMS_Support_Activity_Report_2026-09-24_to_2026-09-25.xlsx", "recipients": "ebhorfilla@gmanetwork.com"}	2026-09-25 05:34:18.929
359	CREATE	assistance	TA-2026-00021	12	{"name": "EUGENE B. HORFILLA"}	2026-09-25 10:18:44.635
360	UPDATE	assistance	TA-2026-00021	12	{"name": "EUGENE B. HORFILLA", "recordId": 21}	2026-09-25 10:20:36.533
361	CREATE	assistance	TA-2026-00022	12	{"name": "EUGENE B. HORFILLA"}	2026-09-25 10:21:48.913
362	UPDATE	assistance	TA-2026-00022	12	{"name": "EUGENE B. HORFILLA", "recordId": 22}	2026-09-25 10:46:54.88
363	BACKUP	System	Backup Downloaded	12	{"user": "EUGENE B. HORFILLA", "tasks": 15, "users": 13, "assistance": 20}	2026-09-25 10:49:10.167
364	MASTERDATA_RETIRE	LOCATION	Transmitter Site	12	{"name": "EUGENE B. HORFILLA", "value": "Transmitter Site"}	2026-09-25 10:49:28.973
365	RESTORE	System	Full Restore (Merge)	12	{"mode": "merge", "user": "EUGENE B. HORFILLA", "auditAdded": 0, "tasksAdded": 0, "usersAdded": 0, "masterAdded": 0, "assistanceAdded": 0}	2026-09-25 11:11:49.706
366	RESTORE	System	Full Restore (Merge)	12	{"mode": "merge", "user": "EUGENE B. HORFILLA", "auditAdded": 0, "tasksAdded": 0, "usersAdded": 0, "masterAdded": 1, "assistanceAdded": 0}	2026-09-25 11:18:41.829
367	MASTERDATA_RETIRE	LOCATION	Transmitter Site	12	{"name": "EUGENE B. HORFILLA", "value": "Transmitter Site"}	2026-09-25 11:21:26.469
368	RESTORE	System	Full Restore (Merge)	12	{"mode": "merge", "user": "EUGENE B. HORFILLA", "auditAdded": 0, "tasksAdded": 0, "usersAdded": 0, "masterAdded": 1, "assistanceAdded": 0}	2026-09-25 11:21:43.878
369	RESTORE	System	Full Restore (Merge)	12	{"mode": "merge", "user": "EUGENE B. HORFILLA", "auditAdded": 0, "tasksAdded": 0, "usersAdded": 1, "masterAdded": 0, "assistanceAdded": 0}	2026-09-25 11:22:36.398
370	LOGIN	auth	Successful Login	12	{"name": "EUGENE B. HORFILLA", "username": "ebhorfilla"}	2026-09-28 04:25:09.307
371	LOGOUT	auth	Successful Logout	12	{"name": "EUGENE B. HORFILLA"}	2026-09-28 12:48:02.976
372	LOGIN	auth	Successful Login	12	{"name": "EUGENE B. HORFILLA", "username": "ebhorfilla"}	2026-09-28 12:48:10.801
373	LOGIN	auth	Successful Login	12	{"name": "EUGENE B. HORFILLA", "username": "ebhorfilla"}	2026-09-28 12:49:50.723
374	LOGOUT	auth	Successful Logout	12	{"name": "EUGENE B. HORFILLA"}	2026-09-28 12:58:51.378
375	LOGOUT	auth	Successful Logout	12	{"name": "EUGENE B. HORFILLA"}	2026-09-28 13:00:35.072
376	LOGIN	auth	Successful Login	12	{"name": "EUGENE B. HORFILLA", "username": "ebhorfilla"}	2026-09-28 13:00:39.503
377	LOGOUT	auth	Successful Logout	12	{"name": "EUGENE B. HORFILLA"}	2026-09-28 13:00:56.403
378	LOGIN	auth	Successful Login	12	{"name": "EUGENE B. HORFILLA", "username": "ebhorfilla"}	2026-09-28 13:01:18.345
379	LOGOUT	auth	Successful Logout	12	{"name": "EUGENE B. HORFILLA"}	2026-09-28 13:15:45.19
380	LOGIN	auth	Successful Login	12	{"name": "EUGENE B. HORFILLA", "username": "ebhorfilla"}	2026-09-28 13:15:58.581
381	LOGIN	auth	Successful Login	12	{"name": "EUGENE B. HORFILLA", "username": "ebhorfilla"}	2026-09-29 11:06:01.161
382	LOGIN	auth	Successful Login	12	{"name": "EUGENE B. HORFILLA", "username": "ebhorfilla"}	2026-09-30 04:16:47.235
383	LOGOUT	auth	Successful Logout	12	{"name": "EUGENE B. HORFILLA"}	2026-09-30 04:17:09.519
384	LOGIN	auth	Successful Login	12	{"name": "EUGENE B. HORFILLA", "username": "ebhorfilla"}	2026-09-30 04:17:34.19
385	LOGIN	auth	Successful Login	12	{"name": "EUGENE B. HORFILLA", "username": "ebhorfilla"}	2026-09-30 04:21:11.782
386	LOGOUT	auth	Successful Logout	12	{"name": "EUGENE B. HORFILLA"}	2026-09-30 07:38:08.384
387	LOGIN	auth	Successful Login	8	{"name": "Test T. User", "username": "testuser"}	2026-09-30 07:38:11.299
388	REPORT_EMAIL_SENT	REPORT	2026-09-01 to 2026-09-30	8	{"user": "Test T. User", "sender": "mreugene2005@gmail.com", "status": "all", "activity": "all", "filename": "MAMS_Support_Activity_Report_2026-09-01_to_2026-09-30.xlsx", "recipients": "ebhorfilla@gmanetwork.com"}	2026-09-30 07:53:10.841
389	REPORT_EMAIL_SENT	REPORT	2026-09-01 to 2026-09-30	8	{"user": "Test T. User", "sender": "mreugene2005@gmail.com", "status": "all", "activity": "all", "filename": "MAMS_Support_Activity_Report_2026-09-01_to_2026-09-30.xlsx", "recipients": "ebhorfilla@gmanetwork.com"}	2026-09-30 07:56:38.19
390	REPORT_EMAIL_SENT	REPORT	2026-09-01 to 2026-09-30	8	{"user": "Test T. User", "sender": "mreugene2005@gmail.com", "status": "all", "activity": "all", "filename": "MAMS_Support_Activity_Report_2026-09-01_to_2026-09-30.xlsx", "recipients": "ebhorfilla@gmanetwork.com"}	2026-09-30 08:12:35.404
391	REPORT_EMAIL_SENT	REPORT	2026-09-01 to 2026-09-30	8	{"user": "Test T. User", "sender": "mreugene2005@gmail.com", "status": "all", "activity": "all", "filename": "MAMS_Support_Activity_Report_2026-09-01_to_2026-09-30.xlsx", "recipients": "ebhorfilla@gmanetwork.com"}	2026-09-30 08:20:15.918
392	REPORT_EMAIL_SENT	REPORT	2026-09-01 to 2026-09-30	8	{"user": "Test T. User", "sender": "mreugene2005@gmail.com", "status": "all", "activity": "all", "filename": "MAMS_Support_Activity_Report_2026-09-01_to_2026-09-30.xlsx", "recipients": "ebhorfilla@gmanetwork.com"}	2026-09-30 08:43:36.552
393	REPORT_EMAIL_SENT	REPORT	2026-09-01 to 2026-09-30	8	{"user": "Test T. User", "sender": "mreugene2005@gmail.com", "status": "all", "activity": "all", "filename": "MAMS_Support_Activity_Report_2026-09-01_to_2026-09-30.xlsx", "recipients": "ebhorfilla@gmanetwork.com"}	2026-09-30 08:59:54.989
394	REPORT_EMAIL_SENT	REPORT	2026-09-24 to 2026-09-24	8	{"user": "Test T. User", "sender": "mreugene2005@gmail.com", "status": "all", "activity": "all", "filename": "MAMS_Support_Activity_Report_2026-09-24_to_2026-09-24.xlsx", "recipients": "ebhorfilla@gmanetwork.com"}	2026-09-30 09:00:57.993
395	REPORT_EMAIL_SENT	REPORT	2026-09-24 to 2026-09-24	8	{"user": "Test T. User", "sender": "mreugene2005@gmail.com", "status": "all", "activity": "all", "filename": "MAMS_Support_Activity_Report_2026-09-24.xlsx", "recipients": "ebhorfilla@gmanetwork.com"}	2026-09-30 09:04:42.721
396	REPORT_EMAIL_SENT	REPORT	2026-09-01 to 2026-09-30	8	{"user": "Test T. User", "sender": "mreugene2005@gmail.com", "status": "all", "activity": "all", "filename": "MAMS_Support_Activity_Report_2026-09-01_to_2026-09-30.xlsx", "recipients": "ebhorfilla@gmanetwork.com"}	2026-09-30 09:05:07.182
397	REPORT_EMAIL_SENT	REPORT	As of 2026-09-24	8	{"user": "Test T. User", "sender": "mreugene2005@gmail.com", "status": "all", "activity": "all", "filename": "MAMS_Support_Activity_Report_2026-09-24.xlsx", "recipients": "ebhorfilla@gmanetwork.com"}	2026-09-30 09:08:25.952
398	REPORT_EMAIL_SENT	REPORT	2026-09-01 to 2026-09-30	8	{"user": "Test T. User", "sender": "mreugene2005@gmail.com", "status": "all", "activity": "all", "filename": "MAMS_Support_Activity_Report_2026-09-01_to_2026-09-30.xlsx", "recipients": "ebhorfilla@gmanetwork.com"}	2026-09-30 09:30:37.345
399	UPDATE_PROFILE	User Profile	Updated testuser	8	{"user": "Test T. User", "changedFields": ["firstName", "middleInitial", "surname", "email", "username", "avatarUrl", "smtpEnabled", "smtpEmail", "smtpRecipients"], "passwordChanged": false, "smtpPasswordChanged": false}	2026-09-30 09:38:36.62
400	REPORT_EMAIL_SENT	REPORT	2026-09-01 to 2026-09-30	8	{"user": "Test T. User", "sender": "mreugene2005@gmail.com", "status": "all", "activity": "all", "filename": "MAMS_Support_Activity_Report_2026-09-01_to_2026-09-30.xlsx", "recipients": "ebhorfilla@gmanetwork.com; FSValois@gmanetwork.com"}	2026-09-30 09:38:57.069
401	REPORT_EMAIL_SENT	REPORT	2026-09-01 to 2026-09-30	8	{"user": "Test T. User", "sender": "mreugene2005@gmail.com", "status": "all", "activity": "all", "filename": "MAMS_Support_Activity_Report_2026-09-01_to_2026-09-30.xlsx", "recipients": "ebhorfilla@gmanetwork.com; FSValois@gmanetwork.com"}	2026-09-30 12:26:13.568
402	UPDATE_PROFILE	User Profile	Updated testuser	8	{"user": "Test T. User", "changedFields": ["firstName", "middleInitial", "surname", "email", "username", "avatarUrl", "smtpEnabled", "smtpEmail", "smtpRecipients"], "passwordChanged": false, "smtpPasswordChanged": false}	2026-09-30 12:26:45.618
403	REPORT_EMAIL_SENT	REPORT	2026-09-01 to 2026-09-30	8	{"user": "Test T. User", "sender": "mreugene2005@gmail.com", "status": "all", "activity": "all", "filename": "MAMS_Support_Activity_Report_2026-09-01_to_2026-09-30.xlsx", "recipients": "ebhorfilla@gmanetwork.com"}	2026-09-30 12:37:41.295
404	LOGIN	auth	Successful Login	12	{"name": "EUGENE B. HORFILLA", "username": "ebhorfilla"}	2026-10-01 05:22:13.462
405	LOGOUT	auth	Successful Logout	12	{"name": "EUGENE B. HORFILLA"}	2026-10-01 05:35:26.035
406	LOGIN	auth	Successful Login	12	{"name": "EUGENE B. HORFILLA", "username": "ebhorfilla"}	2026-10-01 05:35:28.794
407	LOGOUT	auth	Successful Logout	12	{"name": "EUGENE B. HORFILLA"}	2026-10-01 05:37:37.808
408	LOGIN	auth	Successful Login	12	{"name": "EUGENE B. HORFILLA", "username": "ebhorfilla"}	2026-10-06 05:05:26.47
409	MASTERDATA_ADD	ACTIVITY_TYPE	Storage Monitoring	12	{"name": "EUGENE B. HORFILLA", "value": "Storage Monitoring"}	2026-10-06 05:07:19.792
410	MASTERDATA_ADD	SHIFT	12PM - 9PM	12	{"name": "EUGENE B. HORFILLA", "value": "12PM - 9PM"}	2026-10-06 05:08:00.199
411	CREATE	tasks	OT-2026-00019	12	{"name": "EUGENE B. HORFILLA"}	2026-10-06 05:10:07.798
412	LOGIN	auth	Successful Login	12	{"name": "EUGENE B. HORFILLA", "username": "ebhorfilla"}	2026-10-08 13:06:21.912
413	LOGIN	auth	Successful Login	12	{"name": "EUGENE B. HORFILLA", "username": "ebhorfilla"}	2026-10-08 13:06:28.441
414	LOGIN	auth	Successful Login	12	{"name": "EUGENE B. HORFILLA", "username": "ebhorfilla"}	2026-10-08 13:06:29.892
415	LOGIN	auth	Successful Login	12	{"name": "EUGENE B. HORFILLA", "username": "ebhorfilla"}	2026-10-08 13:06:33.654
416	LOGIN	auth	Successful Login	12	{"name": "EUGENE B. HORFILLA", "username": "ebhorfilla"}	2026-10-08 13:06:47.859
417	LOGIN	auth	Successful Login	12	{"name": "EUGENE B. HORFILLA", "username": "ebhorfilla"}	2026-10-08 13:06:48.682
418	LOGIN	auth	Successful Login	12	{"name": "EUGENE B. HORFILLA", "username": "ebhorfilla"}	2026-10-08 13:07:15.579
419	LOGIN	auth	Successful Login	12	{"name": "EUGENE B. HORFILLA", "username": "ebhorfilla"}	2026-10-14 03:14:24.474
420	MASTERDATA_ADD	SHIFT	10AM -7PM	12	{"name": "EUGENE B. HORFILLA", "value": "10AM -7PM"}	2026-10-14 03:15:38.861
421	MASTERDATA_ADD	LOCATION	MAMS Office	12	{"name": "EUGENE B. HORFILLA", "value": "MAMS Office"}	2026-10-14 03:16:29.168
422	MASTERDATA_ADD	SHOW_GROUP	MAMS	12	{"name": "EUGENE B. HORFILLA", "value": "MAMS"}	2026-10-14 03:16:39.255
423	MASTERDATA_ADD	ACTIVITY_TYPE	Technical Issues	12	{"name": "EUGENE B. HORFILLA", "value": "Technical Issues"}	2026-10-14 03:17:24.009
424	MASTERDATA_ADD	ACTIVITY_TYPE	Management Meeting	12	{"name": "EUGENE B. HORFILLA", "value": "Management Meeting"}	2026-10-14 03:17:46.619
425	CREATE	tasks	OT-2026-00020	12	{"name": "EUGENE B. HORFILLA"}	2026-10-14 03:21:35.237
426	CREATE	tasks	OT-2026-00021	12	{"name": "EUGENE B. HORFILLA"}	2026-10-14 03:23:52.805
427	CREATE	tasks	OT-2026-00022	12	{"name": "EUGENE B. HORFILLA"}	2026-10-14 03:26:01.946
428	CREATE	tasks	OT-2026-00023	12	{"name": "EUGENE B. HORFILLA"}	2026-10-14 03:27:10.257
429	REPORT_EMAIL_SENT	REPORT	2026-10-01 to 2026-10-14	12	{"user": "EUGENE B. HORFILLA", "sender": "mreugene2005@gmail.com", "status": "all", "activity": "all", "filename": "MAMS_Support_Activity_Report_2026-10-01_to_2026-10-14.xlsx", "recipients": "ebhorfilla@gmanetwork.com"}	2026-10-14 06:18:53.73
430	REPORT_EMAIL_SENT	REPORT	2026-10-01 to 2026-10-14	12	{"user": "EUGENE B. HORFILLA", "sender": "mreugene2005@gmail.com", "status": "all", "activity": "all", "filename": "MAMS_Support_Activity_Report_2026-10-01_to_2026-10-14.xlsx", "recipients": "ebhorfilla@gmanetwork.com"}	2026-10-14 06:30:51.924
431	REPORT_EMAIL_SENT	REPORT	2026-10-01 to 2026-10-14	12	{"user": "EUGENE B. HORFILLA", "sender": "mreugene2005@gmail.com", "status": "all", "activity": "all", "filename": "MAMS_Support_Activity_Report_2026-10-01_to_2026-10-14.xlsx", "recipients": "ebhorfilla@gmanetwork.com"}	2026-10-14 06:43:42.225
432	REPORT_EMAIL_SENT	REPORT	2026-10-01 to 2026-10-14	12	{"user": "EUGENE B. HORFILLA", "sender": "mreugene2005@gmail.com", "status": "all", "activity": "all", "filename": "MAMS_Support_Activity_Report_2026-10-01_to_2026-10-14.xlsx", "recipients": "ebhorfilla@gmanetwork.com"}	2026-10-14 06:54:27.308
433	CREATE	assistance	TA-2026-00023	12	{"name": "EUGENE B. HORFILLA"}	2026-10-14 10:39:58.505
434	REPORT_EMAIL_SENT	REPORT	As of 2026-10-14	12	{"user": "EUGENE B. HORFILLA", "sender": "mreugene2005@gmail.com", "status": "all", "activity": "all", "filename": "MAMS_Support_Activity_Report_2026-10-14.xlsx", "recipients": "ebhorfilla@gmanetwork.com"}	2026-10-14 10:51:02.232
435	LOGIN	auth	Successful Login	12	{"name": "EUGENE B. HORFILLA", "username": "ebhorfilla"}	2026-10-15 03:59:10.787
436	MASTERDATA_RETIRE	SHIFT	10AM - 6PM	12	{"name": "EUGENE B. HORFILLA", "value": "10AM - 6PM"}	2026-10-15 10:43:19.454
437	MASTERDATA_ADD	SHIFT	10AM -6PM	12	{"name": "EUGENE B. HORFILLA", "value": "10AM -6PM"}	2026-10-15 10:43:35.619
438	MASTERDATA_RETIRE	SHIFT	10AM -6PM	12	{"name": "EUGENE B. HORFILLA", "value": "10AM -6PM"}	2026-10-15 10:43:50.451
439	LOGIN	auth	Successful Login	14	{"name": "Test 3. User", "username": "testuser3"}	2026-10-16 06:13:52.418
440	LOGOUT	auth	Successful Logout	14	{"name": "Test 3. User"}	2026-10-16 06:14:23.586
441	LOGIN	auth	Successful Login	12	{"name": "EUGENE B. HORFILLA", "username": "ebhorfilla"}	2026-10-16 06:14:26.284
442	LOGIN_FAILED	auth	Invalid Username or Password	\N	{"username": "ebhorfila"}	2026-10-16 06:31:13.935
443	LOGIN_FAILED	auth	Invalid Username or Password	\N	{"username": "ebhorfilla"}	2026-10-16 06:31:23.349
444	LOGIN	auth	Successful Login	12	{"name": "EUGENE B. HORFILLA", "username": "ebhorfilla"}	2026-10-16 06:31:28.115
445	LOGOUT	auth	Successful Logout	12	{"name": "EUGENE B. HORFILLA"}	2026-10-16 06:45:42.975
446	LOGIN	auth	Successful Login	12	{"name": "EUGENE B. HORFILLA", "username": "ebhorfilla"}	2026-10-16 06:48:06.264
447	UPDATE_PROFILE	User Profile	Updated ebhorfilla	12	{"user": "EUGENE B. HORFILLA", "changedFields": ["firstName", "middleInitial", "surname", "email", "username", "avatarUrl", "smtpEnabled", "smtpEmail", "smtpRecipients"], "passwordChanged": false, "smtpPasswordChanged": false}	2026-10-16 06:51:35.185
448	REPORT_EMAIL_SENT	REPORT	2026-10-12 to 2026-10-16	12	{"user": "EUGENE B. HORFILLA", "sender": "mreugene2005@gmail.com", "status": "all", "activity": "all", "filename": "MAMS_Support_Activity_Report_2026-10-12_to_2026-10-16.xlsx", "recipients": "ebhorfilla@gmanetwork.com; rcmacorol@gmanetwork.com"}	2026-10-16 06:51:56.646
449	UPDATE_PROFILE	User Profile	Updated ebhorfilla	12	{"user": "EUGENE B. HORFILLA", "changedFields": ["firstName", "middleInitial", "surname", "email", "username", "avatarUrl", "smtpEnabled", "smtpEmail", "smtpRecipients"], "passwordChanged": false, "smtpPasswordChanged": false}	2026-10-16 06:52:45.181
450	UPDATE_PROFILE	User Profile	Updated ebhorfilla	12	{"user": "EUGENE B. HORFILLA", "changedFields": ["firstName", "middleInitial", "surname", "email", "username", "avatarUrl", "smtpEnabled", "smtpEmail", "smtpRecipients"], "passwordChanged": false, "smtpPasswordChanged": false}	2026-10-16 06:52:52.058
451	LOGOUT	auth	Successful Logout	12	{"name": "EUGENE B. HORFILLA"}	2026-10-16 06:53:42.611
452	REPORT_EMAIL_SENT	REPORT	As of 2026-10-16	12	{"user": "EUGENE B. HORFILLA", "sender": "mreugene2005@gmail.com", "status": "all", "activity": "all", "filename": "MAMS_Support_Activity_Report_2026-10-16.xlsx", "recipients": "ebhorfilla@gmanetwork.com"}	2026-10-16 12:59:10.577
453	LOGIN_FAILED	auth	Invalid Username or Password	\N	{"username": "admin@gcc.local"}	2026-10-19 08:55:44.788
454	LOGIN	auth	Successful Login	12	{"name": "EUGENE B. HORFILLA", "username": "ebhorfilla"}	2026-10-19 08:55:47.628
455	LOGIN	auth	Successful Login	12	{"name": "EUGENE B. HORFILLA", "username": "ebhorfilla"}	2026-10-19 10:12:09.404
456	LOGOUT	auth	Successful Logout	12	{"name": "EUGENE B. HORFILLA"}	2026-10-19 12:38:57.19
457	UPDATE_PROFILE	User Profile	Updated ebhorfilla	12	{"user": "Eugene B. Horfilla", "changedFields": ["firstName", "middleInitial", "surname", "email", "username", "avatarUrl", "smtpEnabled", "smtpEmail", "smtpRecipients", "password"], "passwordChanged": true, "smtpPasswordChanged": false}	2026-10-19 12:43:07.1
458	LOGIN	auth	Successful Login	12	{"name": "Eugene B. Horfilla", "username": "ebhorfilla"}	2026-10-20 04:07:01.63
459	LOGOUT	auth	Successful Logout	12	{"name": "Eugene B. Horfilla"}	2026-10-20 06:43:53.11
460	LOGIN	auth	Successful Login	8	{"name": "Test T. User", "username": "testuser"}	2026-10-20 06:43:56.255
461	LOGOUT	auth	Successful Logout	8	{"name": "Test T. User"}	2026-10-20 06:44:22.154
462	LOGIN	auth	Successful Login	4	{"name": "Test 2. User", "username": "testuser2"}	2026-10-20 06:44:25.715
463	LOGOUT	auth	Successful Logout	4	{"name": "Test 2. User"}	2026-10-20 06:45:00.604
464	LOGIN	auth	Successful Login	12	{"name": "Eugene B. Horfilla", "username": "ebhorfilla"}	2026-10-20 06:45:06.872
465	LOGOUT	auth	Successful Logout	12	{"name": "Eugene B. Horfilla"}	2026-10-20 08:12:29.375
466	LOGIN	auth	Successful Login	8	{"name": "Test T. User", "username": "testuser"}	2026-10-20 08:12:32.186
467	LOGOUT	auth	Successful Logout	8	{"name": "Test T. User"}	2026-10-20 08:21:47.02
468	LOGIN	auth	Successful Login	12	{"name": "Eugene B. Horfilla", "username": "ebhorfilla"}	2026-10-20 08:21:50.483
469	UPDATE	assistance	TA-2026-00023	12	{"name": "Eugene B. Horfilla", "recordId": 23}	2026-10-20 08:22:49.963
470	UPDATE	assistance	TA-2026-00023	12	{"name": "Eugene B. Horfilla", "recordId": 23}	2026-10-20 08:28:58.783
471	UPDATE	assistance	TA-2026-00023	12	{"name": "Eugene B. Horfilla", "recordId": 23}	2026-10-20 08:29:13.909
472	UPDATE	assistance	TA-2026-00023	12	{"name": "Eugene B. Horfilla", "recordId": 23}	2026-10-20 08:29:32.568
473	STATUS_CHANGE	assistance	TA-2026-00023	12	{"name": "Eugene B. Horfilla", "timeEnded": null, "nextStatus": "OPEN", "previousStatus": "CLOSED", "previousTimeEnded": "16:28"}	2026-10-20 08:50:10.351
474	STATUS_CHANGE	assistance	TA-2026-00023	12	{"name": "Eugene B. Horfilla", "timeEnded": "16:50", "nextStatus": "CLOSE_PENDING", "previousStatus": "OPEN", "previousTimeEnded": null}	2026-10-20 08:50:36.105
475	STATUS_CHANGE	assistance	TA-2026-00023	12	{"name": "Eugene B. Horfilla", "timeEnded": "16:50", "nextStatus": "CLOSED", "previousStatus": "CLOSE_PENDING", "previousTimeEnded": "16:50"}	2026-10-20 08:51:19.768
476	STATUS_CHANGE	assistance	TA-2026-00023	12	{"name": "Eugene B. Horfilla", "timeEnded": null, "nextStatus": "OPEN", "previousStatus": "CLOSED", "previousTimeEnded": "16:50"}	2026-10-20 08:51:45.378
477	STATUS_CHANGE	assistance	TA-2026-00023	12	{"name": "Eugene B. Horfilla", "timeEnded": "16:52", "nextStatus": "CLOSE_PENDING", "previousStatus": "OPEN", "previousTimeEnded": null}	2026-10-20 08:52:33.156
478	LOGOUT	auth	Successful Logout	12	{"name": "Eugene B. Horfilla"}	2026-10-20 08:59:52.033
479	LOGIN	auth	Successful Login	8	{"name": "Test T. User", "username": "testuser"}	2026-10-20 08:59:54.684
480	LOGOUT	auth	Successful Logout	8	{"name": "Test T. User"}	2026-10-20 09:01:39.337
481	LOGIN	auth	Successful Login	12	{"name": "Eugene B. Horfilla", "username": "ebhorfilla"}	2026-10-20 09:01:43.281
\.


--
-- Data for Name: branding; Type: TABLE DATA; Schema: public; Owner: eugenehorfilla
--

COPY public.branding (id, title, tagline, logo_url, favicon_url, updated_at) FROM stdin;
1	MAMS Support Operations Tracker	Technical assistance and task logging	/uploads/logo-e5e95ca7c19623a1.jpg	/uploads/favicon-52931598c0690d8b.jpg	2026-10-15 05:13:06.825
\.


--
-- Data for Name: counters; Type: TABLE DATA; Schema: public; Owner: eugenehorfilla
--

COPY public.counters (key, value) FROM stdin;
tasks:2026	23
assistance:2026	23
\.


--
-- Data for Name: master_data; Type: TABLE DATA; Schema: public; Owner: eugenehorfilla
--

COPY public.master_data (id, kind, value, active, sort) FROM stdin;
1	LOCATION	Studio A	t	0
2	LOCATION	Studio B	t	1
3	LOCATION	Control Room	t	2
4	LOCATION	Office	t	3
6	SHIFT	Morning	t	0
7	SHIFT	Afternoon	t	1
8	SHIFT	Night	t	2
9	SHOW_GROUP	News	t	0
10	SHOW_GROUP	Entertainment	t	1
11	SHOW_GROUP	Production	t	2
12	SHOW_GROUP	Engineering	t	3
13	CATEGORY	Network	t	0
14	CATEGORY	Hardware	t	1
15	CATEGORY	Software	t	2
16	CATEGORY	Audio	t	3
17	CATEGORY	Video	t	4
18	CATEGORY	Other	t	5
19	ACTIVITY_TYPE	Maintenance	t	0
20	ACTIVITY_TYPE	Installation	t	1
21	ACTIVITY_TYPE	Inspection	t	2
22	ACTIVITY_TYPE	Documentation	t	3
23	ACTIVITY_TYPE	Other	t	4
24	SHIFT	6AM - 2PM	t	0
25	SHIFT	2PM - 10PM	t	0
26	SHIFT	10PM - 6AM	t	0
27	LOCATION	Premiere-LF-01	t	0
28	CATEGORY	Publishing	t	0
29	CATEGORY	Importing	t	0
30	SHOW_GROUP	FAMILY FEUD	t	0
31	SHOW_GROUP	FIREWALL	t	0
32	LOCATION	Premiere-LF-02	t	0
34	LOCATION	Premiere-LF-03	t	0
35	SHIFT	7AM - 3PM	t	0
36	SHOW_GROUP	MAGPAKAILANMAN	t	0
37	CATEGORY	Ingesting	t	0
5	LOCATION	Transmitter Site	t	4
38	ACTIVITY_TYPE	Storage Monitoring	t	0
39	SHIFT	12PM - 9PM	t	0
40	SHIFT	10AM -7PM	t	0
41	LOCATION	MAMS Office	t	0
42	SHOW_GROUP	MAMS	t	0
43	ACTIVITY_TYPE	Technical Issues	t	0
44	ACTIVITY_TYPE	Management Meeting	t	0
33	SHIFT	10AM - 6PM	f	0
45	SHIFT	10AM -6PM	f	0
\.


--
-- Data for Name: tasks; Type: TABLE DATA; Schema: public; Owner: eugenehorfilla
--

COPY public.tasks (id, ref_no, date, shift, location, show_group, activity_type, description, priority, time_started, time_ended, status, assigned, accountable, remarks, owner_id, locked, locked_by_id, created_at, updated_at) FROM stdin;
19	OT-2026-00019	2026-10-06	10AM - 6PM	Office	\N	Storage Monitoring	Performed Storage Monitoring Check.	NORMAL	12:00	12:00	CLOSED	EUGENE B. HORFILLA	EUGENE B. HORFILLA	USAGE: IBM: 80.67% fs5k: 76.50% PMC: 55.64%	12	f	\N	2026-10-06 05:10:07.782	2026-10-06 05:10:07.782
20	OT-2026-00020	2026-10-14	10AM -7PM	MAMS Office	MAMS	Storage Monitoring	Performed storage monitoring check. USAGE: IBM 80.67%, fs5k 76.25%, PMC 56.75%	NORMAL	10:00	10:10	CLOSED	EUGENE B. HORFILLA	EUGENE B. HORFILLA	Monitoring results indicate that both IBM and FS5K storage environments remain above the critical threshold and should continue to be closely monitored for capacity management and storage planning. PMC utilization remains within the normal operating range.	12	f	\N	2026-10-14 03:21:35.224	2026-10-14 03:21:35.224
21	OT-2026-00021	2026-10-14	10AM -7PM	MAMS Office	MAMS	Management Meeting	Attended the coordination meeting for the KMJS Gabi ng Lagim episode regarding the planned 24p production workflow.	NORMAL	10:10	11:10	CLOSED	EUGENE B. HORFILLA	EUGENE B. HORFILLA	The discussion covered reminders and requirements for acquisition, editing, MAMS publishing, and dub-out processes.	12	f	\N	2026-10-14 03:23:52.798	2026-10-14 03:23:52.798
22	OT-2026-00022	2026-10-14	10AM -7PM	MAMS Office	MAMS	Technical Issues	On October 13, 2026, Joenathan V. Dumlao reported an issue with the segment BN_IJUAND_051825_S0305, where the Vizrt Studio Create Story function could not be performed. The incident was documented and escalated to Vizrt Support via a formal support case for investigation and root cause analysis.	NORMAL	11:10	11:20	CLOSED	EUGENE B. HORFILLA	EUGENE B. HORFILLA	The MAMS Technical Team has coordinated with the vendor and is awaiting feedback. Further updates will be provided once Vizrt completes its assessment and recommends a resolution.	12	f	\N	2026-10-14 03:26:01.943	2026-10-14 03:26:01.943
23	OT-2026-00023	2026-10-14	10AM -7PM	MAMS Office	MAMS	Technical Issues	A new slow publishing incident involving BO_THEMAS_000116_S0101 was reported on 12 October 2026. Unlike previous cases, the issue could not be resolved using the established workaround of regenerating proxy copies. MAMS-Tech acknowledged the incident and confirmed that it has already been escalated to the Vizrt Support Team for further investigation.	NORMAL	11:20	11:30	CLOSED	EUGENE B. HORFILLA	EUGENE B. HORFILLA	Despite the recent deployment of the slow publishing patch, similar incidents have continued to occur, indicating that the issue may still persist in certain workflows. The case remains under investigation, and updates will be provided once feedback is received from Vizrt Support.	12	f	\N	2026-10-14 03:27:10.254	2026-10-14 03:27:10.254
\.


--
-- Data for Name: users; Type: TABLE DATA; Schema: public; Owner: eugenehorfilla
--

COPY public.users (id, first_name, middle_initial, surname, email, username, password_hash, role, avatar_url, active, last_login, created_at, smtp_email, smtp_enabled, smtp_password, smtp_recipients) FROM stdin;
8	Test	T	User	sisfrunio@opslog.local	testuser	$2a$10$n7WICAAUkVMM.V.t.k7Ezen.EsHzomn7cKVc12Kybi/bbaqIxPvu6	USER	\N	t	2026-10-20 08:59:54.681	2026-09-02 07:50:07.137	mreugene2005@gmail.com	t	ztncikyceuyubpci	ebhorfilla@gmanetwork.com
1	System	\N	Administrator	admin@opslog.local	admin	$2a$10$u4RCKpoFryqMvYiKq1K6KuodluGpdzSMFpdIDxIi8GTiP8ULGBQvy	ADMIN	\N	t	2026-09-08 01:34:17.198	2026-09-02 07:50:06.543	\N	f	\N	\N
13	Rodrigo	E	Leynes	releynes@gmanetwork.com	releynes	$2a$10$XT/fTQcEKhFoV5lckHARWel2fKEWhJlvYk2jLoOrC977Sp5nyFo/q	USER	\N	t	2026-09-08 01:36:24.806	2026-09-08 01:36:02.123	\N	f	\N	\N
12	Eugene	B	Horfilla	mreugene2005@gmail.com	ebhorfilla	$2a$10$xXYs/S9.z2n0to4yF33Rsuhru5qQT776vGskYFdMKIWi8TfHc6e9u	ADMIN	/uploads/avatar-4e5cd7f47b93000c.jpg	t	2026-10-20 09:01:43.275	2026-09-02 07:58:26.783	mreugene2005@gmail.com	t	ztncikyceuyubpci	ebhorfilla@gmanetwork.com
14	Test	3	User	testuser3@emial.com	testuser3	$2a$10$AFv.BZXd3vTrdnPFF5rTDeOOnl6NlTgnXLYMxRJK8R0/zG8440vY2	USER	\N	t	2026-10-16 06:13:52.407	2026-10-15 05:40:27.062	\N	t	\N	\N
4	Test	2	User	patty@opslog.local	testuser2	$2a$10$wLxUmWtcZvfcB7rp80mmUer6UJISgVdYSv.A7KAgvAtA3CM7G6opW	USER	\N	t	2026-10-20 06:44:25.711	2026-09-02 07:50:06.801	mreugene2005@gmail.com	t	ztncikyceuyubpci	ebhorfilla@gmanetwork.com
\.


--
-- Name: assistance_id_seq; Type: SEQUENCE SET; Schema: public; Owner: eugenehorfilla
--

SELECT pg_catalog.setval('public.assistance_id_seq', 23, true);


--
-- Name: audit_logs_id_seq; Type: SEQUENCE SET; Schema: public; Owner: eugenehorfilla
--

SELECT pg_catalog.setval('public.audit_logs_id_seq', 481, true);


--
-- Name: master_data_id_seq; Type: SEQUENCE SET; Schema: public; Owner: eugenehorfilla
--

SELECT pg_catalog.setval('public.master_data_id_seq', 45, true);


--
-- Name: tasks_id_seq; Type: SEQUENCE SET; Schema: public; Owner: eugenehorfilla
--

SELECT pg_catalog.setval('public.tasks_id_seq', 23, true);


--
-- Name: users_id_seq; Type: SEQUENCE SET; Schema: public; Owner: eugenehorfilla
--

SELECT pg_catalog.setval('public.users_id_seq', 14, true);


--
-- Name: _prisma_migrations _prisma_migrations_pkey; Type: CONSTRAINT; Schema: public; Owner: eugenehorfilla
--

ALTER TABLE ONLY public._prisma_migrations
    ADD CONSTRAINT _prisma_migrations_pkey PRIMARY KEY (id);


--
-- Name: ai_settings ai_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: eugenehorfilla
--

ALTER TABLE ONLY public.ai_settings
    ADD CONSTRAINT ai_settings_pkey PRIMARY KEY (id);


--
-- Name: assistance assistance_pkey; Type: CONSTRAINT; Schema: public; Owner: eugenehorfilla
--

ALTER TABLE ONLY public.assistance
    ADD CONSTRAINT assistance_pkey PRIMARY KEY (id);


--
-- Name: audit_logs audit_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: eugenehorfilla
--

ALTER TABLE ONLY public.audit_logs
    ADD CONSTRAINT audit_logs_pkey PRIMARY KEY (id);


--
-- Name: branding branding_pkey; Type: CONSTRAINT; Schema: public; Owner: eugenehorfilla
--

ALTER TABLE ONLY public.branding
    ADD CONSTRAINT branding_pkey PRIMARY KEY (id);


--
-- Name: counters counters_pkey; Type: CONSTRAINT; Schema: public; Owner: eugenehorfilla
--

ALTER TABLE ONLY public.counters
    ADD CONSTRAINT counters_pkey PRIMARY KEY (key);


--
-- Name: master_data master_data_pkey; Type: CONSTRAINT; Schema: public; Owner: eugenehorfilla
--

ALTER TABLE ONLY public.master_data
    ADD CONSTRAINT master_data_pkey PRIMARY KEY (id);


--
-- Name: tasks tasks_pkey; Type: CONSTRAINT; Schema: public; Owner: eugenehorfilla
--

ALTER TABLE ONLY public.tasks
    ADD CONSTRAINT tasks_pkey PRIMARY KEY (id);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: eugenehorfilla
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: assistance_assigned_idx; Type: INDEX; Schema: public; Owner: eugenehorfilla
--

CREATE INDEX assistance_assigned_idx ON public.assistance USING btree (assigned);


--
-- Name: assistance_date_idx; Type: INDEX; Schema: public; Owner: eugenehorfilla
--

CREATE INDEX assistance_date_idx ON public.assistance USING btree (date);


--
-- Name: assistance_ref_no_key; Type: INDEX; Schema: public; Owner: eugenehorfilla
--

CREATE UNIQUE INDEX assistance_ref_no_key ON public.assistance USING btree (ref_no);


--
-- Name: assistance_status_idx; Type: INDEX; Schema: public; Owner: eugenehorfilla
--

CREATE INDEX assistance_status_idx ON public.assistance USING btree (status);


--
-- Name: audit_logs_created_at_idx; Type: INDEX; Schema: public; Owner: eugenehorfilla
--

CREATE INDEX audit_logs_created_at_idx ON public.audit_logs USING btree (created_at);


--
-- Name: audit_logs_entity_type_idx; Type: INDEX; Schema: public; Owner: eugenehorfilla
--

CREATE INDEX audit_logs_entity_type_idx ON public.audit_logs USING btree (entity_type);


--
-- Name: master_data_kind_value_key; Type: INDEX; Schema: public; Owner: eugenehorfilla
--

CREATE UNIQUE INDEX master_data_kind_value_key ON public.master_data USING btree (kind, value);


--
-- Name: tasks_assigned_idx; Type: INDEX; Schema: public; Owner: eugenehorfilla
--

CREATE INDEX tasks_assigned_idx ON public.tasks USING btree (assigned);


--
-- Name: tasks_date_idx; Type: INDEX; Schema: public; Owner: eugenehorfilla
--

CREATE INDEX tasks_date_idx ON public.tasks USING btree (date);


--
-- Name: tasks_ref_no_key; Type: INDEX; Schema: public; Owner: eugenehorfilla
--

CREATE UNIQUE INDEX tasks_ref_no_key ON public.tasks USING btree (ref_no);


--
-- Name: tasks_status_idx; Type: INDEX; Schema: public; Owner: eugenehorfilla
--

CREATE INDEX tasks_status_idx ON public.tasks USING btree (status);


--
-- Name: users_email_key; Type: INDEX; Schema: public; Owner: eugenehorfilla
--

CREATE UNIQUE INDEX users_email_key ON public.users USING btree (email);


--
-- Name: users_username_key; Type: INDEX; Schema: public; Owner: eugenehorfilla
--

CREATE UNIQUE INDEX users_username_key ON public.users USING btree (username);


--
-- Name: assistance assistance_locked_by_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: eugenehorfilla
--

ALTER TABLE ONLY public.assistance
    ADD CONSTRAINT assistance_locked_by_id_fkey FOREIGN KEY (locked_by_id) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: assistance assistance_owner_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: eugenehorfilla
--

ALTER TABLE ONLY public.assistance
    ADD CONSTRAINT assistance_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: tasks tasks_locked_by_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: eugenehorfilla
--

ALTER TABLE ONLY public.tasks
    ADD CONSTRAINT tasks_locked_by_id_fkey FOREIGN KEY (locked_by_id) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: tasks tasks_owner_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: eugenehorfilla
--

ALTER TABLE ONLY public.tasks
    ADD CONSTRAINT tasks_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- PostgreSQL database dump complete
--

\unrestrict vbSy2ZFFbMsksdzY6s7cglIMjpHioSvnpuygRWy4sePBDklfnyxLvX9QgC3Yxga

