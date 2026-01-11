# Smart Schedule - AI-Powered Task Manager

<div align="center">
  <h3>🤖 Manage Your Tasks with AI-Powered Intelligence</h3>
  <p>An intelligent task management platform that helps you organize, prioritize, and complete your tasks efficiently with AI assistance and Google Calendar integration.</p>
</div>

## ✨ Features

### 🧠 AI-Powered Task Management
- **Smart Chat Interface**: Natural language interaction with an AI assistant for task management
- **Intelligent Task Creation**: AI helps you break down complex tasks and set priorities
- **Automated Scheduling**: AI-powered scheduling suggestions based on your preferences and deadlines
- **Task Analytics**: AI-driven insights into your productivity patterns

### 📅 Calendar Integration
- **Google Calendar Sync**: Seamless integration with Google Calendar
- **Smart Scheduling**: Automatically schedule tasks based on availability and priorities
- **Calendar Event Management**: Create, update, and manage calendar events directly from the app
- **Deadline Tracking**: Visual deadline management with calendar integration

### 📊 Advanced Task Features
- **Priority Management**: Set and manage task priorities (High, Medium, Low)
- **Task Dependencies**: Define relationships between tasks
- **Complexity Assessment**: Rate task complexity for better time estimation
- **Duration Tracking**: Set estimated durations for better scheduling
- **Status Management**: Track task completion status
- **Categories**: Organize tasks into custom categories

### 🔐 Authentication & Security
- **Firebase Authentication**: Secure user authentication and authorization
- **User-Specific Data**: Each user's data is completely isolated and secure
- **Session Management**: Persistent login sessions with secure token handling

### 📱 Modern UI/UX
- **Responsive Design**: Works seamlessly on desktop, tablet, and mobile devices
- **Dark/Light Theme**: Toggle between dark and light themes
- **Modern Components**: Built with Radix UI and Tailwind CSS
- **Loading States**: Smooth loading animations and skeleton screens
- **Toast Notifications**: Real-time feedback for user actions

### 📈 Analytics & Insights
- **Task Statistics**: Comprehensive analytics about your task completion
- **Productivity Insights**: Track your productivity patterns over time
- **Performance Metrics**: Visualize your task management efficiency

## 🛠️ Technology Stack

### Frontend
- **Framework**: Next.js 15.2.4 with React 19
- **Language**: TypeScript
- **Styling**: Tailwind CSS with custom design system
- **UI Components**: Radix UI primitives
- **Icons**: Lucide React
- **Charts**: Recharts for data visualization
- **Forms**: React Hook Form with Zod validation

### Backend & Services
- **Authentication**: Firebase Auth
- **Database**: Firebase Firestore
- **File Storage**: Firebase Storage
- **API Routes**: Next.js API routes
- **Calendar API**: Google Calendar API integration

### Development Tools
- **Package Manager**: pnpm
- **Code Quality**: ESLint
- **Type Safety**: TypeScript with strict mode
- **Build Tool**: Next.js built-in compiler

## 🚀 Getting Started

### Prerequisites
- Node.js (version 18 or higher)
- pnpm (recommended) or npm
- Firebase project with Firestore and Authentication enabled
- Google Cloud Console project with Calendar API enabled

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd aitaskmanager11
   ```

2. **Install dependencies**
   ```bash
   pnpm install
   ```

3. **Set up environment variables**
   Create a `.env.local` file in the root directory:
   ```env
   # Firebase Configuration
   NEXT_PUBLIC_FIREBASE_API_KEY=your_api_key
   NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_auth_domain
   NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
   NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_storage_bucket
   NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
   NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id

   # Google Calendar API
   NEXT_PUBLIC_GOOGLE_CLIENT_ID=your_google_client_id
   ```

4. **Set up Firebase**
   - Create a new Firebase project
   - Enable Authentication (Email/Password)
   - Create a Firestore database
   - Add your web app configuration to the environment variables

5. **Set up Google Calendar API**
   - Go to Google Cloud Console
   - Enable Calendar API
   - Create OAuth 2.0 credentials
   - Add your client ID to environment variables

6. **Run the development server**
   ```bash
   pnpm dev
   ```

7. **Open the application**
   Navigate to [http://localhost:3000](http://localhost:3000) in your browser

## 📁 Project Structure

```
├── app/                    # Next.js app directory
│   ├── api/               # API routes
│   ├── dashboard/         # Dashboard pages
│   ├── login/            # Authentication pages
│   ├── tasks/            # Task management pages
│   └── analytics/        # Analytics pages
├── components/            # Reusable React components
│   ├── ui/               # Base UI components (Radix UI)
│   └── ai-chat/          # AI chat interface
├── hooks/                # Custom React hooks
├── lib/                  # Utility libraries and services
│   ├── ai-service.ts     # AI chat and task processing
│   ├── auth.ts           # Authentication utilities
│   ├── calendar-service.ts # Google Calendar integration
│   ├── firebase.ts       # Firebase configuration
│   └── task-service.ts   # Task management logic
├── types/                # TypeScript type definitions
└── styles/               # Global styles and CSS
```

## 🔧 Configuration

### Firebase Setup
1. Create collections in Firestore:
   - `users` - User profiles and settings
   - `tasks` - Task data with user-specific documents
   - `analytics` - User analytics and statistics

2. Set up Firestore security rules to ensure user data isolation

### Google Calendar Integration
1. Enable Calendar API in Google Cloud Console
2. Configure OAuth 2.0 consent screen
3. Add authorized redirect URIs for your domain

## 📝 Usage

### Creating Tasks
1. **Via Dashboard**: Use the task creation form in the dashboard
2. **Via AI Chat**: Simply tell the AI what task you want to create
3. **From Calendar**: Create tasks directly from calendar events

### AI Assistant Commands
- "Create a task to finish the project proposal"
- "Show me my tasks for today"
- "Schedule my high-priority tasks for tomorrow"
- "What's my productivity this week?"
- "Mark the meeting task as completed"

### Calendar Integration
- Connect your Google Calendar in Settings
- Tasks automatically sync with your calendar
- Schedule tasks based on your availability
- View tasks alongside calendar events

## 🚀 Deployment

### Vercel (Recommended)
1. Connect your GitHub repository to Vercel
2. Add environment variables in Vercel dashboard
3. Deploy automatically on every push

### Manual Deployment
```bash
# Build the application
pnpm build

# Start the production server
pnpm start
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🐛 Issues & Support

If you encounter any issues or have questions:
1. Check the [Issues](https://github.com/your-repo/issues) page
2. Create a new issue with detailed information
3. Include steps to reproduce any bugs

## 🔮 Roadmap

- [ ] Mobile app development (React Native)
- [ ] Team collaboration features
- [ ] Advanced AI task suggestions
- [ ] Multiple calendar provider support
- [ ] Offline functionality
- [ ] Task templates and automation
- [ ] Integration with popular productivity tools

## 🙏 Acknowledgments

- [Next.js](https://nextjs.org/) for the amazing React framework
- [Firebase](https://firebase.google.com/) for backend services
- [Radix UI](https://www.radix-ui.com/) for accessible UI components
- [Tailwind CSS](https://tailwindcss.com/) for utility-first styling
- [Google Calendar API](https://developers.google.com/calendar) for calendar integration

---

<div align="center">
  <p>Made with ❤️ for better productivity</p>
</div>
