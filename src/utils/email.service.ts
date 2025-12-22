import nodemailer, { Transporter } from 'nodemailer';
import logger from '../config/logger';

export interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

class EmailService {
  private transporter!: Transporter;
  private isConfigured: boolean = false;

  constructor() {
    this.initializeTransporter();
  }

  private initializeTransporter(): void {
    const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD } = process.env;

    if (!SMTP_HOST || !SMTP_PORT || !SMTP_USER || !SMTP_PASSWORD) {
      logger.warn('Email service not configured. Missing SMTP environment variables.');
      this.isConfigured = false;
      return;
    }

    try {
      this.transporter = nodemailer.createTransport({
        service: 'gmail',
        // host: SMTP_HOST,
        // port: parseInt(SMTP_PORT),
        // secure: false, // true for 465, false for other ports
        auth: {
          user: SMTP_USER,
          pass: SMTP_PASSWORD,
        },
        tls: {
          rejectUnauthorized: false, // For development, accept self-signed certificates
        },
      });

      this.isConfigured = true;
      logger.info('Email service configured successfully');
    } catch (error) {
      logger.error('Failed to configure email service:', error);
      this.isConfigured = false;
    }
  }

  /**
   * Send an email
   */
  async sendEmail(options: EmailOptions): Promise<boolean> {
    if (!this.isConfigured) {
      logger.warn('Email service not configured. Skipping email send.');
      return false;
    }

    try {
      const mailOptions = {
        from: `"PrimaCard Odonto" <${process.env.SMTP_USER}>`,
        to: options.to,
        subject: options.subject,
        html: options.html,
        text: options.text || this.htmlToText(options.html),
      };

      const info = await this.transporter.sendMail(mailOptions);
      logger.info(`Email sent successfully to ${options.to}. MessageId: ${info.messageId}`);
      return true;
    } catch (error: any) {
      logger.error(`Failed to send email to ${options.to}:`, error);
      return false;
    }
  }

  /**
   * Send password reset email with temporary password
   */
  async sendPasswordResetEmail(email: string, temporaryPassword: string, userName: string): Promise<boolean> {
    const subject = 'Nova Senha - PrimaCard Odonto';
    const html = this.getPasswordResetTemplate(userName, temporaryPassword);
    
    return this.sendEmail({ to: email, subject, html });
  }

  /**
   * Send points received notification
   */
  async sendPointsReceivedEmail(
    email: string,
    userName: string,
    pointsReceived: number,
    reason: string,
    totalBalance: number
  ): Promise<boolean> {
    const subject = `🎉 Você ganhou ${pointsReceived} pontos!`;
    const html = this.getPointsReceivedTemplate(userName, pointsReceived, reason, totalBalance);
    
    return this.sendEmail({ to: email, subject, html });
  }

  /**
   * Send new appointment notification to professional
   */
  async sendNewAppointmentToProfessional(
    professionalEmail: string,
    professionalName: string,
    patientName: string,
    procedureName: string,
    appointmentDate: Date
  ): Promise<boolean> {
    const subject = '🔔 Nova Solicitação de Consulta';
    const html = this.getNewAppointmentTemplate(
      professionalName,
      patientName,
      procedureName,
      appointmentDate
    );
    
    return this.sendEmail({ to: professionalEmail, subject, html });
  }

  /**
   * Send appointment confirmation to patient
   */
  async sendAppointmentConfirmedToPatient(
    patientEmail: string,
    patientName: string,
    professionalName: string,
    procedureName: string,
    appointmentDate: Date
  ): Promise<boolean> {
    const subject = '✅ Consulta Confirmada - PrimaCard Odonto';
    const html = this.getAppointmentConfirmedTemplate(
      patientName,
      professionalName,
      procedureName,
      appointmentDate
    );
    
    return this.sendEmail({ to: patientEmail, subject, html });
  }

  /**
   * Send appointment completed notification to patient
   */
  async sendAppointmentCompletedToPatient(
    patientEmail: string,
    patientName: string,
    professionalName: string,
    procedureName: string,
    pointsEarned: number
  ): Promise<boolean> {
    const subject = '🎊 Consulta Finalizada - Obrigado!';
    const html = this.getAppointmentCompletedTemplate(
      patientName,
      professionalName,
      procedureName,
      pointsEarned
    );
    
    return this.sendEmail({ to: patientEmail, subject, html });
  }

  // =====================
  // EMAIL TEMPLATES
  // =====================

  private getBaseTemplate(content: string): string {
    return `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>PrimaCard Odonto</title>
  <style>
    body {
      margin: 0;
      padding: 0;
      font-family: 'Arial', sans-serif;
      background-color: #f4f4f4;
    }
    .container {
      max-width: 600px;
      margin: 0 auto;
      background-color: #ffffff;
    }
    .header {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      padding: 30px;
      text-align: center;
    }
    .header h1 {
      color: #ffffff;
      margin: 0;
      font-size: 28px;
    }
    .content {
      padding: 40px 30px;
      color: #333333;
      line-height: 1.6;
    }
    .button {
      display: inline-block;
      padding: 12px 30px;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: #ffffff;
      text-decoration: none;
      border-radius: 5px;
      margin: 20px 0;
      font-weight: bold;
    }
    .footer {
      background-color: #f8f8f8;
      padding: 20px;
      text-align: center;
      color: #666666;
      font-size: 12px;
    }
    .highlight {
      background-color: #f0f0ff;
      padding: 15px;
      border-radius: 5px;
      margin: 20px 0;
      border-left: 4px solid #667eea;
    }
    .points-badge {
      display: inline-block;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      padding: 10px 20px;
      border-radius: 25px;
      font-size: 24px;
      font-weight: bold;
      margin: 10px 0;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🦷 PrimaCard Odonto</h1>
    </div>
    <div class="content">
      ${content}
    </div>
    <div class="footer">
      <p>© 2025 PrimaCard Odonto. Todos os direitos reservados.</p>
      <p>Este é um email automático, por favor não responda.</p>
    </div>
  </div>
</body>
</html>
    `;
  }

  private getPasswordResetTemplate(userName: string, temporaryPassword: string): string {
    const content = `
      <h2>Olá, ${userName}!</h2>
      <p>Você solicitou a recuperação de senha da sua conta PrimaCard Odonto.</p>
      
      <div class="highlight">
        <h3 style="margin-top: 0;">Sua nova senha temporária:</h3>
        <p style="font-size: 32px; font-weight: bold; color: #667eea; text-align: center; letter-spacing: 4px;">
          ${temporaryPassword}
        </p>
      </div>
      
      <p><strong>⚠️ Importante:</strong></p>
      <ul>
        <li>Use esta senha para fazer login no aplicativo</li>
        <li>Recomendamos que você altere sua senha após o primeiro acesso</li>
        <li>Esta senha é válida e deve ser mantida em sigilo</li>
      </ul>
      
      <p>Se você não solicitou esta alteração, entre em contato conosco imediatamente.</p>
      
      <p>Atenciosamente,<br><strong>Equipe PrimaCard Odonto</strong></p>
    `;
    
    return this.getBaseTemplate(content);
  }

  private getPointsReceivedTemplate(
    userName: string,
    pointsReceived: number,
    reason: string,
    totalBalance: number
  ): string {
    const content = `
      <h2>Parabéns, ${userName}! 🎉</h2>
      <p>Você acabou de ganhar pontos no programa PrimaCard!</p>
      
      <div class="highlight" style="text-align: center;">
        <div class="points-badge">+${pointsReceived} pontos</div>
        <p style="margin: 10px 0;"><strong>Motivo:</strong> ${reason}</p>
      </div>
      
      <p><strong>Seu saldo atual:</strong></p>
      <p style="font-size: 24px; color: #667eea; font-weight: bold; text-align: center;">
        ${totalBalance} pontos
      </p>
      
      <p>Continue cuidando da sua saúde bucal e acumule ainda mais pontos para trocar por recompensas incríveis!</p>
      
      <p>Atenciosamente,<br><strong>Equipe PrimaCard Odonto</strong></p>
    `;
    
    return this.getBaseTemplate(content);
  }

  private getNewAppointmentTemplate(
    professionalName: string,
    patientName: string,
    procedureName: string,
    appointmentDate: Date
  ): string {
    const formattedDate = new Intl.DateTimeFormat('pt-BR', {
      dateStyle: 'full',
      timeStyle: 'short',
    }).format(appointmentDate);
    
    const content = `
      <h2>Olá, Dr(a). ${professionalName}!</h2>
      <p>Você recebeu uma nova solicitação de consulta.</p>
      
      <div class="highlight">
        <p><strong>👤 Paciente:</strong> ${patientName}</p>
        <p><strong>🦷 Procedimento:</strong> ${procedureName}</p>
        <p><strong>📅 Data e Hora:</strong> ${formattedDate}</p>
      </div>
      
      <p>Acesse o aplicativo PrimaCard para visualizar mais detalhes e confirmar o agendamento.</p>
      
      <p>Atenciosamente,<br><strong>Equipe PrimaCard Odonto</strong></p>
    `;
    
    return this.getBaseTemplate(content);
  }

  private getAppointmentConfirmedTemplate(
    patientName: string,
    professionalName: string,
    procedureName: string,
    appointmentDate: Date
  ): string {
    const formattedDate = new Intl.DateTimeFormat('pt-BR', {
      dateStyle: 'full',
      timeStyle: 'short',
    }).format(appointmentDate);
    
    const content = `
      <h2>Ótima notícia, ${patientName}! ✅</h2>
      <p>Sua consulta foi confirmada pelo profissional.</p>
      
      <div class="highlight">
        <p><strong>👨‍⚕️ Profissional:</strong> Dr(a). ${professionalName}</p>
        <p><strong>🦷 Procedimento:</strong> ${procedureName}</p>
        <p><strong>📅 Data e Hora:</strong> ${formattedDate}</p>
      </div>
      
      <p><strong>📝 Orientações:</strong></p>
      <ul>
        <li>Chegue com 10 minutos de antecedência</li>
        <li>Traga documento com foto</li>
        <li>Em caso de imprevistos, cancele com pelo menos 24h de antecedência</li>
      </ul>
      
      <p>Estamos ansiosos para atendê-lo(a)!</p>
      
      <p>Atenciosamente,<br><strong>Equipe PrimaCard Odonto</strong></p>
    `;
    
    return this.getBaseTemplate(content);
  }

  private getAppointmentCompletedTemplate(
    patientName: string,
    professionalName: string,
    procedureName: string,
    pointsEarned: number
  ): string {
    const content = `
      <h2>Obrigado, ${patientName}! 🎊</h2>
      <p>Sua consulta foi finalizada com sucesso.</p>
      
      <div class="highlight">
        <p><strong>👨‍⚕️ Profissional:</strong> Dr(a). ${professionalName}</p>
        <p><strong>🦷 Procedimento:</strong> ${procedureName}</p>
        ${pointsEarned > 0 ? `
          <div style="text-align: center; margin-top: 15px;">
            <div class="points-badge">+${pointsEarned} pontos</div>
            <p style="margin-top: 10px;">Pontos adicionados à sua conta!</p>
          </div>
        ` : ''}
      </div>
      
      <p>Esperamos que você tenha tido uma ótima experiência!</p>
      
      <p><strong>💬 Sua opinião é importante!</strong></p>
      <p>Acesse o aplicativo PrimaCard para avaliar o atendimento que você recebeu. Sua avaliação nos ajuda a melhorar continuamente.</p>
      
      <p>Atenciosamente,<br><strong>Equipe PrimaCard Odonto</strong></p>
    `;
    
    return this.getBaseTemplate(content);
  }

  /**
   * Convert HTML to plain text (fallback)
   */
  private htmlToText(html: string): string {
    return html
      .replace(/<style[^>]*>.*<\/style>/gm, '')
      .replace(/<[^>]+>/gm, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * Verify transporter configuration (for testing)
   */
  async verifyConnection(): Promise<boolean> {
    if (!this.isConfigured) {
      return false;
    }

    try {
      await this.transporter.verify();
      logger.info('Email service connection verified successfully');
      return true;
    } catch (error) {
      logger.error('Email service connection verification failed:', error);
      return false;
    }
  }
}

export default new EmailService();
