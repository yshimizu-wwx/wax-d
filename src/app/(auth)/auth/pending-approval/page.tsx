import Link from 'next/link';

export default function PendingApprovalPage() {
    return (
        <main className="min-h-screen bg-gradient-to-br from-amber-50 via-white to-orange-50 flex items-center justify-center p-4">
            <div className="w-full max-w-md text-center">
                <div className="bg-white rounded-3xl shadow-xl border border-slate-200 p-8">
                    <div className="w-20 h-20 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-6">
                        <i className="fas fa-clock text-amber-600 text-4xl"></i>
                    </div>

                    <h1 className="text-3xl font-black text-slate-800 mb-4">
                        ありがとうございます
                    </h1>

                    <p className="text-slate-600 mb-2 font-bold">
                        アカウントは審査中です
                    </p>

                    <p className="text-slate-500 text-sm mb-8">
                        管理者による承認をお待ちください。<br />
                        承認が完了次第、メールでお知らせいたします。
                    </p>

                    <Link
                        href="/login"
                        className="inline-block bg-slate-600 text-white px-8 py-4 rounded-xl font-black shadow-lg hover:bg-slate-500 transition-colors"
                    >
                        <i className="fas fa-home mr-2"></i>
                        トップページへ
                    </Link>
                </div>
            </div>
        </main>
    );
}
