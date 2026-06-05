import React from 'react';
import {
  Html,
  Head,
  Body,
  Container,
  Heading,
  Text,
  Hr,
  Section,
  Row,
  Column,
} from '@react-email/components';

interface OrderConfirmationEmailProps {
  orderId: string;
  customerName: string;
  totalAmount: number;
}

export const OrderConfirmationEmail = ({
  orderId,
  customerName,
  totalAmount,
}: OrderConfirmationEmailProps) => {
  return (
    <Html>
      <Head />
      <Body style={main}>
        <Container style={container}>
          <Heading style={h1}>Mithila Enterprises</Heading>
          <Text style={h2}>Order Confirmation</Text>
          <Hr style={hr} />
          
          <Text style={text}>Dear {customerName},</Text>
          <Text style={text}>
            Thank you for your order! We are currently processing it and will notify you once it has shipped.
          </Text>

          <Section style={orderBox}>
            <Row>
              <Column>
                <Text style={boldText}>Order ID:</Text>
                <Text style={text}>{orderId.split('-')[0].toUpperCase()}</Text>
              </Column>
              <Column>
                <Text style={boldText}>Total Amount:</Text>
                <Text style={text}>₹{totalAmount.toFixed(2)}</Text>
              </Column>
            </Row>
          </Section>

          <Text style={text}>
            Please find your official tax invoice attached to this email as a PDF.
          </Text>

          <Hr style={hr} />
          <Text style={footer}>
            Mithila Enterprises<br />
            GSTIN: 07AGUPM2548P1ZH<br />
            Delhi, India
          </Text>
        </Container>
      </Body>
    </Html>
  );
};

const main = {
  backgroundColor: '#f6f9fc',
  fontFamily: '-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Ubuntu,sans-serif',
};

const container = {
  backgroundColor: '#ffffff',
  margin: '0 auto',
  padding: '40px 20px',
  borderRadius: '5px',
  border: '1px solid #eee',
  maxWidth: '600px',
};

const h1 = {
  color: '#333',
  fontSize: '24px',
  fontWeight: 'bold',
  textAlign: 'center' as const,
  margin: '0 0 10px 0',
};

const h2 = {
  color: '#666',
  fontSize: '16px',
  textAlign: 'center' as const,
  margin: '0 0 20px 0',
  textTransform: 'uppercase' as const,
  letterSpacing: '2px',
};

const text = {
  color: '#555',
  fontSize: '14px',
  lineHeight: '24px',
};

const boldText = {
  color: '#333',
  fontSize: '12px',
  fontWeight: 'bold',
  textTransform: 'uppercase' as const,
  letterSpacing: '1px',
};

const hr = {
  borderColor: '#eee',
  margin: '20px 0',
};

const orderBox = {
  backgroundColor: '#f9f9f9',
  padding: '20px',
  borderRadius: '4px',
  margin: '20px 0',
};

const footer = {
  color: '#888',
  fontSize: '12px',
  lineHeight: '16px',
  textAlign: 'center' as const,
};
