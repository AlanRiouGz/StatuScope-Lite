import { Redirect } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
export default function Index() {
  const { profile } = useAuth();
  return <Redirect href={profile ? '/dashboard/doctor' : '/login'} />;
}
