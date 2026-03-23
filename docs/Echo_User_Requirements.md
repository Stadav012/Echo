# **Aim** This document defines the user requirements for Echo, an AI-driven research assistant platform that automates the execution of qualitative user research interviews via outbound phone calls. It serves as the authoritative reference for design, development and testing decisions.​

# **Scope** Echo targets researchers, students, PhD candidates and small teams who have already identified potential participants and need a scalable, automated way to conduct, record and analyze structured or semi-structured interviews without manual coordination.

# **Definitions**

| Term | Definition |
| :---- | :---- |
| Researcher | The primary user who configures and launches interview campaigns |
| Participant | The end-user contacted by Echo for an interview |
| Campaign | A batch of interviews targeting a defined participant list |
| Agent | The AI conversational entity that conducts phone calls |
| Transcript | The structured text output of a completed interview |

# **Stakeholders & User Personas**

## **Persona 1:The Academic Researcher**

Name: Dr. Umut (PhD Candidate, Social Sciences)  
Goal: Conduct 50+ semi-structured interviews for dissertation research within two weeks, without a research assistant.  
Pain Points: Manual scheduling, no-shows, note-taking fatigue, time zones.

## **Persona 2 : The UX Designer / Product Team**

Name: Delvin (Product Manager, Early-Stage Startup)  
Goal: Gather rapid user feedback from an existing customer list before a feature launch.  
Pain Points: Limited bandwidth, no dedicated research ops, needs fast turnaround.

**Persona 3 :The Ethics-Conscious Researcher**

Name: Lena (Research Compliance Officer)  
Goal: Ensure all interviews are conducted with documented informed consent and stored securely.  
Pain Points: GDPR compliance, data retention policies, consent documentation.

# **Functional Requirements**

**1.Campaign Management**

| ID | Requirement | Priority |
| :---- | :---- | :---- |
| FR-CM-01 | The system shall allow a researcher to create a new interview campaign by providing a campaign name, description, and target participant count | High |
| FR-CM-02 | The system shall allow the researcher to upload a participant list in CSV format containing at minimum: name, phone number, and preferred contact time window | High |
| FR-CM-03 | The system shall allow the researcher to define a custom interview question set (structured or semi-structured) for each campaign | High |
| FR-CM-04 | The system shall allow the researcher to preview the interview script before launching a campaign | Medium |
| FR-CM-05 | The system shall allow the researcher to pause, resume, or cancel an active campaign at any time | High |
| FR-CM-06 | The system shall support scheduling campaigns for future start times or immediate launch | Medium |

**2.AI Interview Agent**

| ID | Requirement | Priority |
| :---- | :---- | :---- |
| FR-AI-01 | The AI agent shall initiate outbound phone calls to participants using Twilio telephony infrastructure | High |
| FR-AI-02 | The agent shall introduce itself, state the purpose of the call, and obtain verbal confirmation of consent before proceeding | High |
| FR-AI-03 | The agent shall ask the researcher's predefined questions in sequence while maintaining a natural, conversational tone | High |
| FR-AI-04 | The agent shall dynamically generate relevant follow-up questions when a participant's response is vague, incomplete, or introduces a new theme | High |
| FR-AI-05 | The agent shall gracefully handle participant interruptions, pauses, or requests to repeat a question | Medium |
| FR-AI-06 | The agent shall conclude the call professionally, thank the participant, and inform them of how their data will be used | High |
| FR-AI-07 | The agent shall detect and handle call failures (e.g., no answer, voicemail) and log the outcome accordingly | High |

**3.Scheduling & Outreach Automation**

| ID | Requirement | Priority |
| :---- | :---- | :---- |
| FR-SC-01 | The system shall automatically initiate calls within participant-specified time windows provided during campaign setup | High |
| FR-SC-02 | The system shall send an automated SMS or pre-call notification to participants prior to the scheduled call time | Medium |
| FR-SC-03 | The system shall automatically retry unreached participants up to a configurable number of times (default: 3\) at different times within their available window | High |
| FR-SC-04 | The system shall allow participants to reschedule via an SMS reply or a web link | Medium |

**4.Real-Time Transcription & Data Capture**

| ID | Requirement | Priority |
| :---- | :---- | :---- |
| FR-TR-01 | The system shall record all calls with participant consent and store recordings securely | High |
| FR-TR-02 | The system shall transcribe conversations in real time using a speech-to-text service | High |
| FR-TR-03 | The system shall stream transcripts via Apache Kafka to downstream services (follow-up generator, UI dashboard, storage) simultaneously | High |
| FR-TR-04 | The system shall structure transcript output by question, mapping each response to its originating question | High |
| FR-TR-05 | The system shall flag segments where the participant expressed uncertainty, strong sentiment, or provided notably rich detail | Low |

**5.Researcher Dashboard**

| ID | Requirement | Priority |
| :---- | :---- | :---- |
| FR-DB-01 | The system shall provide a researcher dashboard displaying the real-time status of all calls in an active campaign (e.g., Pending, In Progress, Completed, Failed) | High |
| FR-DB-02 | The dashboard shall display a live transcript feed for any ongoing call | Medium |
| FR-DB-03 | The system shall allow the researcher to view, search, and filter completed interview transcripts | High |
| FR-DB-04 | The system shall provide downloadable transcript exports in CSV, JSON, and PDF formats | High |
| FR-DB-05 | The dashboard shall display aggregate campaign analytics: completion rate, average call duration, no-show rate, and retry success rate | Medium |

 Consent & Compliance

| ID | Requirement | Priority |
| :---- | :---- | :---- |
| FR-CO-01 | The system shall play or verbally deliver a consent statement at the start of every call before any research questions are asked | High |
| FR-CO-02 | The system shall log participant consent (verbal confirmation) as a timestamped event tied to the call record | High |
| FR-CO-03 | The system shall provide the researcher with the ability to define a custom consent statement per campaign | Medium |
| FR-CO-04 | The system shall allow participants to opt out at any point during the call, terminating the interview and flagging the record accordingly | High |

## 

# **Non-Functional Requirements**

 1.Performance

| ID | Requirement | Metric |
| :---- | :---- | :---- |
| NFR-P-01 | The system shall support a minimum of 10 concurrent outbound calls without degradation | ≥ 10 simultaneous active calls |
| NFR-P-02 | Real-time transcription latency shall not exceed 2 seconds from spoken word to displayed text | ≤ 2s latency |
| NFR-P-03 | The AI agent shall generate a follow-up question within 1.5 seconds of detecting a complete participant response | ≤ 1.5s response generation |
| NFR-P-04 | The dashboard shall reflect call status updates within 3 seconds of a state change | ≤ 3s UI update |

**2.Security & Privacy**

| ID | Requirement |
| :---- | :---- |
| NFR-S-01 | All call recordings and transcripts shall be encrypted at rest and in transit (TLS 1.3) |
| NFR-S-02 | Participant phone numbers and personal data shall be stored separately from transcript data using data segregation |
| NFR-S-03 | The system shall comply with GDPR and applicable data protection regulations, including the right to erasure |
| NFR-S-04 | Role-based access control (RBAC) shall restrict transcript and recording access to authorized campaign members only |
| NFR-S-05 | The system shall maintain an audit log of all data access and export events |

3\.**Usability**

| ID | Requirement |
| :---- | :---- |
| NFR-U-01 | A researcher with no prior training shall be able to create and launch a campaign within 15 minutes |
| NFR-U-02 | The system shall provide inline guidance and tooltips on all campaign configuration steps |
| NFR-U-03 | The dashboard shall be accessible on modern browsers (Chrome, Firefox, Safari, Edge) without requiring plugins |
| NFR-U-04 | The system shall be responsive and usable on tablet and desktop screen sizes |

**4.Reliability & Availability**

| ID | Requirement |
| :---- | :---- |
| NFR-R-01 | The platform shall maintain 99.5% uptime during active campaign hours |
| NFR-R-02 | The system shall automatically save and resume a call-in-progress transcript if a network interruption occurs |
| NFR-R-03 | Call recordings shall be backed up within 5 minutes of call completion |

**User Stories**  
1.As a researcher, I want to upload a CSV of participants so that I can launch a campaign without manually entering each contact.

2.As a researcher, I want the AI agent to ask my predefined questions and generate intelligent follow-ups so that I collect deep qualitative data without conducting each call myself.  
   
3\. As a researcher, I want to see live call statuses on a dashboard so that I can monitor campaign progress in real time.  
   
4.As a participant, I want to be called within my stated availability window so that the interview doesn't disrupt my schedule.  
   
5.As a participant, I want to be able to decline or exit the interview at any time so that my participation remains voluntary.  
   
6\.  As a researcher, I want to download all transcripts in CSV format so that I can import them directly into my analysis tools.  
   
7.As a compliance officer, I want all participant consent to be logged with a timestamp so that I can demonstrate ethical compliance during review

## **Constraints & Assumptions** **Constraints**

* C-01: The system relies on Twilio's telephony API,availability is subject to Twilio's SLA.  
* C-02: Participants must have a functioning phone number reachable via standard PSTN or VoIP.  
* C-03: The AI agent will conduct interviews in English only in the initial version    
* C-04: The system does not handle participant recruitment ,researchers must supply their own participant list.

## **Assumptions**

* A-01: Researchers have obtained prior permission or willing consent from participants before uploading them to the platform.  
* A-02: Participants have stable enough phone connections to sustain a 5–30 minute call.  
* A-03: The researcher is responsible for ensuring their use of Echo complies with institutional ethics board (IRB/REC) requirements.

 

