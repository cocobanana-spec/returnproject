// 알 수 없는 경로로 들어왔을 때의 안전망. 막다른 화면에 가두지 않고 첫 화면으로 되돌린다
import { Redirect } from 'expo-router';

export default function NotFound() {
  return <Redirect href="/" />;
}
