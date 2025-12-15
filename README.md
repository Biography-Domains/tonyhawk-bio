# Tony Hawk Biography

Official biography site for skateboarding legend Tony Hawk featuring achievements, gallery, timeline, and fan interaction

## Tech Stack
- **Frontend**: HTML/CSS/JavaScript with Tailwind CSS
- **Backend**: FASTAPI
- **Database**: Neon (Serverless PostgreSQL)
- **ORM**: SQLAlchemy

## Features
- Crud
- Auth

## Pages
- Home
- About
- Achievements
- Gallery
- Timeline
- Contact

## Quick Start

### 1. Set up Neon Database
1. Create account at https://neon.tech
2. Create a new project
3. Copy the connection string

### 2. Configure Environment
```bash
cp .env.example .env
# Edit .env with your Neon connection string
```

### 3. Initialize Database
```bash
# Run the schema
psql $DATABASE_URL < database/schema.sql
```

### 4. Start Backend
```bash
cd backend
pip install -r requirements.txt
uvicorn main:app --reload
```

### 5. Start Frontend
```bash
cd frontend
python -m http.server 8080
# Or use any static file server
```

## API Endpoints
- `GET /visitors` - List all visitors
- `GET /visitors/{id}` - Get single visitors
- `POST /visitors` - Create visitors
- `PUT /visitors/{id}` - Update visitors
- `DELETE /visitors/{id}` - Delete visitors
- `GET /achievements` - List all achievements
- `GET /achievements/{id}` - Get single achievements
- `POST /achievements` - Create achievements
- `PUT /achievements/{id}` - Update achievements
- `DELETE /achievements/{id}` - Delete achievements
- `GET /gallery` - List all gallery
- `GET /gallery/{id}` - Get single gallery
- `POST /gallery` - Create gallery
- `PUT /gallery/{id}` - Update gallery
- `DELETE /gallery/{id}` - Delete gallery
- `GET /messages` - List all messages
- `GET /messages/{id}` - Get single messages
- `POST /messages` - Create messages
- `PUT /messages/{id}` - Update messages
- `DELETE /messages/{id}` - Delete messages
- `POST /auth/register` - Register user
- `POST /auth/login` - Login user
- `POST /auth/logout` - Logout user
- `GET /auth/me` - Get current user

## Database Tables
- `visitors`
- `achievements`
- `gallery`
- `messages`

## Deployment

### Deploy to Vercel + Neon
1. Push code to GitHub
2. Connect to Vercel
3. Add `DATABASE_URL` environment variable
4. Deploy!

### Deploy to Railway
1. Connect GitHub repo
2. Add Neon DATABASE_URL
3. Railway handles the rest
