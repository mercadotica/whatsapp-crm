import { NextResponse } from 'next/server';

// Protege todo o site com usuário/senha simples (Basic Auth), exceto o
// webhook — que precisa ficar público pra Meta conseguir chamar.
export function middleware(req) {
  const { pathname } = req.nextUrl;
  if (pathname.startsWith('/api/webhook')) {
    return NextResponse.next();
  }

  const auth = req.headers.get('authorization');
  const expected = 'Basic ' + Buffer.from(`admin:${process.env.DASHBOARD_PASSWORD}`).toString('base64');

  if (auth === expected) {
    return NextResponse.next();
  }

  return new NextResponse('Autenticação necessária', {
    status: 401,
    headers: { 'WWW-Authenticate': 'Basic realm="Secure"' },
  });
}

export const config = {
  matcher: '/((?!_next/static|_next/image|favicon.ico).*)',
};
