/** MariaDB 예제 전용 자식 프로세스. HTTP로 노출하거나 직접 실행하는 파일이 아니다. */
async function main() {
    let input = '';
    process.stdin.setEncoding('utf8');
    for await (const chunk of process.stdin) input += chunk;
    const { config, sql, parameters } = JSON.parse(input);
    const mariadb = require('mariadb');
    const connection = await mariadb.createConnection({ ...config, connectTimeout: 5000, socketTimeout: 10000 });
    try {
        const result = await connection.query(sql, parameters);
        // INSERT의 BigInt 메타데이터는 필요 없으므로 조회 행만 반환한다.
        process.stdout.write(JSON.stringify(Array.isArray(result) ? result : []));
    } finally {
        await connection.end();
    }
}

main().catch(() => {
    // 오류에 연결 정보·비밀번호가 포함될 수 있어 원문을 출력하지 않는다.
    process.stderr.write('MariaDB 연결 또는 쿼리 실패\n');
    process.exitCode = 1;
});
