import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { api } from './api'
import ProjectDashboard from './components/ProjectDashboard'
import TopicCreateWizard from './components/TopicCreateWizard'
import TopicCommandCentre from './components/TopicCommandCentre'
import MemoryReview from './components/MemoryReview'

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<ProjectDashboard />} />
        <Route path="/topics" element={<ProjectDashboard />} />
        <Route 
          path="/topics/new" 
          element={
            <TopicCreateWizard 
              onSubmit={async (data) => {
                console.log('Created topic:', data);
                try {
                  const response = await api.post<any>('/api/topics/', {
                    title: data.title,
                    objective: data.objective,
                    strategic_context: data.strategicContext
                  });
                  return response.data;
                } catch (error) {
                  console.error(error);
                  throw error;
                }
              }} 
            />
          } 
        />
        <Route 
          path="/topics/:topicId/command-centre" 
          element={<TopicCommandCentreWrapper />} 
        />
        <Route 
          path="/topics/:topicId/memory-review" 
          element={<MemoryReviewWrapper />} 
        />
      </Routes>
    </BrowserRouter>
  )
}

// Simple wrappers to extract URL params since components take id as prop
import { useParams } from 'react-router-dom';

function TopicCommandCentreWrapper() {
  const { topicId } = useParams();
  return <TopicCommandCentre topicId={topicId!} />;
}

function MemoryReviewWrapper() {
  const { topicId } = useParams();
  return <MemoryReview topicId={topicId!} />;
}

export default App
