export function appointmentBookedTemplate(data: {
  patientName: string;
  doctorName: string;
  date: string;
  time: string;
}) {
  return `
    <div style="font-family: Arial, sans-serif;">
      <h2>Appointment Booked</h2>

      <p>Hello ${data.patientName},</p>

      <p>Your appointment has been successfully booked.</p>

      <p>
        <strong>Doctor:</strong> ${data.doctorName}<br>
        <strong>Date:</strong> ${data.date}<br>
        <strong>Time:</strong> ${data.time}
      </p>

      <p>Thank you.</p>
    </div>
  `;
}


export function appointmentRescheduledTemplate(data: {
  recipientName: string;
  doctorName: string;
  date: string;
  time: string;
  reason?: string;
}) {
  return `
    <div style="font-family: Arial, sans-serif;">
      <h2>Appointment Rescheduled</h2>

      <p>Hello ${data.recipientName},</p>

      <p>Your appointment has been rescheduled.</p>

      <p>
        <strong>Doctor:</strong> ${data.doctorName}<br>
        <strong>New Date:</strong> ${data.date}<br>
        <strong>New Time:</strong> ${data.time}
      </p>

      ${
        data.reason
          ? `<p><strong>Reason:</strong> ${data.reason}</p>`
          : ''
      }

      <p>Please check your new appointment time.</p>
    </div>
  `;
}


export function appointmentCancelledTemplate(data: {
  patientName: string;
  doctorName: string;
  date: string;
  time: string;
}) {
  return `
    <div style="font-family: Arial, sans-serif;">
      <h2>Appointment Cancelled</h2>

      <p>Hello ${data.patientName},</p>

      <p>Your appointment has been cancelled.</p>

      <p>
        <strong>Doctor:</strong> ${data.doctorName}<br>
        <strong>Date:</strong> ${data.date}<br>
        <strong>Time:</strong> ${data.time}
      </p>

      <p>You can book another available appointment.</p>
    </div>
  `;
}