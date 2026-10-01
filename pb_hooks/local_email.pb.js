// Local test package: intentionally does not call e.next(), so no mail is sent.
onMailerSend((e) => {
  console.log("Local test: outgoing email suppressed.");
});
