/* SIM+EHR Student Edition — site settings. Edit this file to connect optional services.

   VIDEO VISITS ("Call patient")
   The sim never talks to a video provider directly, because an API key must not sit in a page
   that students open. Instead it asks a small server that you run. Set `endpoint` to that server's
   address. The sim sends:

     POST <endpoint>   Content-Type: application/json
     { "patientId": "p2", "patientName": "Santos, Maria", "context": "<persona brief built from the chart>" }

   and expects back:

     { "conversation_url": "https://..." }

   which it shows inside the call window. Your server holds the provider key (for example Tavus),
   creates the conversation with the brief as the persona's context, and must allow this page's
   origin through CORS. Leave `endpoint` empty and the Call patient window explains that video
   visits are not connected yet. */
(function () {
  window.EHR.CONFIG = {
    videoVisit: {
      endpoint: '',
    },
    /* The simulated hospital (js/sim.js). Delays are in seconds.
       attending: when a student works alone, a simulated attending cosigns or declines pended orders and
       cosigns notes, with feedback. Set to false if faculty will log in as Physician and cosign themselves. */
    sim: { attending: true, attendingDelay: 40, noteDelay: 60, consultDelay: 45, nursingDelay: 20, vitalsDelay: 30 },
    /* Shifts and consequences (js/shift.js).
       minutes: real minutes for one shift, 07:00 to 19:00 hospital time. The phase times are hospital clock times.
       harmDelay: seconds between a harmful order taking effect and the patient getting worse.
       rescueHours: hospital hours the learner has to respond before a rapid response and transfer to intensive care.
         One hospital hour is always (minutes x 60 / 12) real seconds, in or out of a shift.
       strikes: harm events before privileges are suspended (1 = a page, 2 = a debrief before more orders, 3 = suspension).
       remediationQuestions / remediationPass: the round that lifts a suspension. */
    shift: { minutes: 16, startHour: 7, endHour: 19, rounds: 8.5, dayWork: 9.5, signOut: 17.5, harmDelay: 30, rescueHours: 3, strikes: 3, remediationQuestions: 5, remediationPass: 4 },
  };
})();
