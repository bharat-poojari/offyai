const REPORT_RECIPIENT = "bharatp0316@gmail.com";
const REPORT_SUBJECT = "Report regarding the chat response";

const openGmailFallback = (report) => {
  const params = new URLSearchParams({
    view: "cm",
    fs: "1",
    to: REPORT_RECIPIENT,
    su: REPORT_SUBJECT,
    body: [
      "Please describe the issue with this chat response below.",
      "",
      "The complete report is available in the attached/generated report file:",
      report.reportPath || "offyai-chat-report.txt",
    ].join("\n"),
  });

  window.location.assign(
    `https://mail.google.com/mail/u/0/?${params.toString()}`
  );
};

export const reportChat = async ({
  title = "Chat report",
  messages = [],
  reportedMessage = null,
  userMessage = null,
}) => {
  const report = {
    title,
    reportedMessage,
    userMessage,
    messages,
    createdAt: new Date().toISOString(),
  };

  const body = JSON.stringify(report, null, 2);

  if (window.electronAPI?.reportChat) {
    return window.electronAPI.reportChat({
      ...report,
      body,
    });
  }

  openGmailFallback({ body, reportPath: "offyai-chat-report.txt" });

  return { success: true, fallback: "gmail" };
};