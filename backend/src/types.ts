/**
 * Type definitions for the Survey AI backend
 */

export interface Survey {
  id: string;
  title: string;
  description: string;
  questions: Question[];
  createdAt: Date;
  updatedAt: Date;
}

export interface Question {
  id: string;
  type: "text" | "voice" | "multiple-choice" | "rating";
  question: string;
  options?: string[];
  required: boolean;
}

export interface SurveyResponse {
  id: string;
  surveyId: string;
  answers: Answer[];
  completedAt: Date;
}

export interface Answer {
  questionId: string;
  value: string | number;
  voiceRecordingUrl?: string;
}

export interface VoiceProcessingRequest {
  audioData: string; // base64 encoded audio
  format: string;
}

export interface VoiceProcessingResponse {
  transcription: string;
  confidence: number;
}
