import Link from 'next/link';

export default function VerifiedPage() {
    return (
        <main className="min-h-screen bg-gradient-to-br from-green-50 via-white to-blue-50 flex items-center justify-center p-4">
            <div className="w-full max-w-md text-center">
                <div className="bg-white rounded-3xl shadow-xl border border-slate-200 p-8">
                    <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
                        <i className="fas fa-check-circle text-green-600 text-4xl"></i>
                    </div>

                    <h1 className="text-3xl font-black text-slate-800 mb-4">
                        登録が完了しました！
                    </h1>

                    <p className="text-slate-600 mb-8">
                        メール認証が完了しました。<br />
                        ログインして利用を開始してください。
                    </p>

                    <Link
                        href="/login"
                        className="inline-block bg-green-600 text-white px-8 py-4 rounded-xl font-black shadow-lg hover:bg-green-500 transition-colors"
                    >
                        <i className="fas fa-sign-in-alt mr-2"></i>
                        ログイン画面へ
                    </Link>
                </div>
            </div>
        </main>
    );
}
