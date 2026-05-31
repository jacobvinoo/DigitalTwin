import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import TopicCreateWizard from './components/TopicCreateWizard'
import TopicCommandCentre from './components/TopicCommandCentre'
import MemoryReview from './components/MemoryReview'

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/topics/new" />} />
        <Route path="/topics" element={<Navigate to="/topics/new" />} />
        <Route 
          path="/topics/new" 
          element={
            <TopicCreateWizard 
              onSubmit={(data) => {
                console.log('Created topic:', data);
                // The redirection logic will be inside TopicCreateWizard itself
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
