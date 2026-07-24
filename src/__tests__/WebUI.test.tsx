import React from 'react';
import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import SummarizerForm from '../components/SummarizerForm';
import CommunityFeed from '../components/CommunityFeed';

// Mock Firebase service calls to avoid real Firestore network during UI tests
jest.mock('../services/firebaseService', () => ({
  getPublicSummaries: jest.fn().mockResolvedValue([
    {
      id: 'sum-1',
      userId: 'user-1',
      userDisplayName: 'أحمد علي',
      videoUrl: 'https://www.youtube.com/watch?v=y2xclL3Nf_w',
      videoId: 'y2xclL3Nf_w',
      videoTitle: 'محاضرة الذكاء الاصطناعي',
      summaryText: '# مقدمة في الذكاء الاصطناعي\n- نقطة رئيسية 1',
      isPublic: true,
      createdAt: { toDate: () => new Date() }
    }
  ]),
  deleteSummary: jest.fn().mockResolvedValue(true)
}));

describe('Web UI Core Functionality Tests', () => {
  test('renders YouTube URL input field and submit button in SummarizerForm', () => {
    render(
      <SummarizerForm
        user={null}
        userConfig={null}
        onSummaryGenerated={jest.fn()}
      />
    );

    const inputField = screen.getByPlaceholderText(/أدخل رابط فيديو يوتيوب هنا/i);
    expect(inputField).toBeInTheDocument();

    const submitBtn = screen.getByRole('button', { name: /ابدأ التلخيص الذكي/i });
    expect(submitBtn).toBeInTheDocument();
  });

  test('renders Community Feed and suggestions correctly', async () => {
    render(
      <CommunityFeed
        onSelectSummary={jest.fn()}
        user={null}
      />
    );

    const communityTitle = await screen.findByText(/Community Suggestions/i);
    expect(communityTitle).toBeInTheDocument();

    const sampleSummaryTitle = await screen.findByText(/محاضرة الذكاء الاصطناعي/i);
    expect(sampleSummaryTitle).toBeInTheDocument();
  });
});
