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
  };
})();
