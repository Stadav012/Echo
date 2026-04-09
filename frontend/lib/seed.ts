import { supabase } from "./supabase";

export const seedDatabase = async (userId: string) => {
  // 1. Create Campaigns
  const { data: campaigns, error: campErr } = await supabase
    .from("campaigns")
    .insert([
      {
        user_id: userId,
        name: "User Onboarding Study",
        description: "Understanding pain points in the first-time user experience for mobile app onboarding",
        status: "active",
        participants_count: 48,
        target_completed: 31,
        questions_count: 8,
        avg_duration_seconds: 14 * 60 + 23,
      },
      {
        user_id: userId,
        name: "Product Satisfaction Q2",
        description: "Quarterly customer satisfaction interviews for enterprise clients",
        status: "active",
        participants_count: 120,
        target_completed: 87,
        questions_count: 12,
        avg_duration_seconds: 11 * 60 + 50,
      },
      {
        user_id: userId,
        name: "Feature Prioritization",
        description: "Gathering user preferences on upcoming feature roadmap items",
        status: "completed",
        participants_count: 35,
        target_completed: 35,
        questions_count: 6,
        avg_duration_seconds: 9 * 60 + 12,
      },
      {
        user_id: userId,
        name: "Accessibility Feedback",
        description: "Interviews with users who rely on assistive technologies",
        status: "scheduled",
        participants_count: 60,
        target_completed: 0,
        questions_count: 10,
        avg_duration_seconds: 0,
      },
    ])
    .select();

  if (campErr || !campaigns) {
    console.error("Error seeding campaigns", campErr);
    return;
  }

  const c1 = campaigns[0].id;
  const c2 = campaigns[1].id;

  // 2. Create Calls
  const { data: calls, error: callsErr } = await supabase
    .from("calls")
    .insert([
      {
        campaign_id: c1,
        participant_name: "Sarah M.",
        participant_phone: "+1 (555) 234-5678",
        status: "in-progress",
        duration_seconds: 4 * 60 + 23,
        current_question_index: 3,
        current_question_text: "What was your first impression of the app?",
      },
      {
        campaign_id: c1,
        participant_name: "James K.",
        participant_phone: "+1 (555) 345-6789",
        status: "in-progress",
        duration_seconds: 2 * 60 + 10,
        current_question_index: 2,
        current_question_text: "Can you describe any challenges you faced during sign-up?",
      },
      {
        campaign_id: c2,
        participant_name: "Maria L.",
        participant_phone: "+44 7911 123456",
        status: "in-progress",
        duration_seconds: 8 * 60 + 45,
        current_question_index: 7,
        current_question_text: "How would you rate your overall experience with our support team?",
      },
      {
        campaign_id: c1,
        participant_name: "David Brown",
        participant_phone: "+1 (555) 000-0000",
        status: "completed",
        duration_seconds: 12 * 60 + 34,
      },
    ])
    .select();

  if (callsErr || !calls) {
    console.error("Error seeding calls", callsErr);
    return;
  }

  // 3. Create Transcripts
  await supabase.from("transcripts").insert([
    {
      call_id: calls[3].id,
      sentiment: "negative",
      excerpt: "I had trouble connecting my external accounts. The integration page kept failing silently...",
      full_text: "Full transcript text here...",
      questions_count: 8,
    },
  ]);

  window.location.reload();
};
