import { useSession } from 'next-auth/react';
import Head from 'next/head';
import Navbar from '../../components/Navbar';
import Footer from '../../components/Footer';
import StudentTrainingDashboard from '../../components/student/StudentTrainingDashboard';

export default function StudentDashboard() {
  const { data: session, status } = useSession();

  return (
    <>
      <Head>
        <title>Mis Entrenamientos - Dashboard Estudiante</title>
        <meta name="description" content="Dashboard del estudiante para gestionar entrenamientos de Zero 2 Trader" />
      </Head>

      <Navbar />
      
      <main style={{ minHeight: '100vh', paddingTop: '80px' }}>
        <StudentTrainingDashboard />
      </main>

      <Footer />
    </>
  );
}
