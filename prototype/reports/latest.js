// Тестовые данные прототипа. В реальной работе файл пишет /standup (window.REPORT) и /tests (window.TESTS_REPORT).
window.REPORT = {
  meta: {
    generated_at: "2026-10-20T09:42:00+03:00",
    generated_by: "Алексей Морозов (техлид)",
    team: "Платежи",
    sources: { jira: "ok", bitbucket: "ok", jenkins: "unavailable", testops: "ok" },
    setup_hints: [
      { name: "jenkins", reason: "не отвечает: 401 Unauthorized — проверьте JENKINS_TOKEN", doc_url: "https://confluence.example.ru/display/DEVOPS/MCP+Jenkins" }
    ],
    tests_report: "tests-2026-10-20.json"
  },
  status: {
    level: "red",
    summary: "Smoke-регресс красный, у Олега нет задач в работе, PR в pay-core висит 3 дня"
  },
  sprint: {
    name: "Спринт 42", state: "active", start: "2026-10-12", end: "2026-10-23",
    day: 7, days_total: 10, done_pct: 46, sp_done: 23, sp_total: 50,
    scope_added: [
      { key: "PAY-1290", title: "Хотфикс округления комиссии", url: "#" },
      { key: "PAY-1294", title: "Логирование отказов СБП", url: "#" }
    ],
    risk: "При текущем темпе не закроются 3 задачи (≈11 SP)"
  },
  people: [
    { name: "Иван Петров", role: "dev", absent: null,
      active: [
        { key: "PAY-1271", title: "Возвраты по СБП: новый статус REFUND_PENDING", status: "Ревью", days_no_move: 1, url: "#" }
      ],
      prs: [{ repo: "pay-core", id: 812, url: "#" }], blockers: [], flags: [] },
    { name: "Анна Смирнова", role: "dev", absent: null,
      active: [
        { key: "PAY-1268", title: "Лимиты по картам: пересчёт при смене тарифа", status: "В работе", days_no_move: 3, url: "#" },
        { key: "PAY-1280", title: "Миграция таблицы limits", status: "В работе", days_no_move: 1, url: "#" },
        { key: "PAY-1290", title: "Хотфикс округления комиссии", status: "В работе", days_no_move: 0, url: "#" }
      ],
      prs: [{ repo: "pay-limits", id: 233, url: "#" }], blockers: [], flags: ["3 задачи в работе", "PAY-1268 без движения 3 дня"] },
    { name: "Олег Кузнецов", role: "dev", absent: null,
      active: [], prs: [], blockers: [], flags: ["нет задач в работе"] },
    { name: "Мария Иванова", role: "qa", absent: null,
      active: [
        { key: "PAY-1265", title: "Тестирование выплат самозанятым", status: "Тестирование", days_no_move: 2, url: "#" }
      ],
      prs: [], blockers: [{ key: "PAY-1265", text: "стенд ift-2 недоступен с понедельника", url: "#" }], flags: ["заблокирована стендом"] },
    { name: "Дмитрий Соколов", role: "aqa", absent: null,
      active: [
        { key: "PAY-1277", title: "Автотесты на возвраты СБП", status: "В работе", days_no_move: 0, url: "#" }
      ],
      prs: [{ repo: "pay-autotests", id: 145, url: "#" }], blockers: [], flags: [] },
    { name: "Елена Волкова", role: "analyst", absent: { to: "2026-10-26", reason: "отпуск" },
      active: [
        { key: "PAY-1284", title: "Требования к рассрочке", status: "В работе", days_no_move: 4, url: "#" }
      ],
      prs: [], blockers: [], flags: ["в отпуске, задача без заменяющего"] }
  ],
  signals: [
    { id: "s1", level: "red", category: "tests", text: "Smoke pay-smoke красный: 14 из 120 упали, 11 из них — новые", owner: "Дмитрий Соколов", age_days: 0, url: "#",
      reminder: "Дмитрий, smoke pay-smoke красный (14 падений, 11 новых). Глянь, пожалуйста, вкладку «Тесты» и отпишись до 12:00, что из этого окружение, а что баги." },
    { id: "s2", level: "red", category: "people", text: "Олег Кузнецов: нет задач в работе со вчерашнего дня", owner: "Олег Кузнецов", age_days: 1, url: "#",
      reminder: "Олег, у тебя сейчас нет задач в работе в спринте 42. Возьми, пожалуйста, PAY-1268 у Анны или PAY-1288 из бэклога спринта — договоримся на стендапе." },
    { id: "s3", level: "red", category: "pr", text: "PR pay-core#807 без движения 3 дня, ход ревьюеров (Иван Петров)", owner: "Иван Петров", age_days: 3, url: "#",
      reminder: "Иван, PR pay-core#807 «Идемпотентность платёжных callback-ов» ждёт твоего ревью 3 дня: https://bitbucket.example.ru/projects/PAY/repos/pay-core/pull-requests/807" },
    { id: "s4", level: "yellow", category: "people", text: "Анна Смирнова: 3 задачи в работе, PAY-1268 без движения 3 дня", owner: "Анна Смирнова", age_days: 3, url: "#",
      reminder: "Анна, у тебя 3 задачи в работе, PAY-1268 не двигается 3 дня. Давай отдадим её Олегу и сфокусируешься на хотфиксе PAY-1290?" },
    { id: "s5", level: "yellow", category: "release", text: "PAY-1250 «Release 2.0: выплаты самозанятым» — дата 22.10, связанная задача PAY-1265 ещё в тестировании", owner: "Мария Иванова", age_days: 0, url: "#",
      reminder: "Мария, релиз PAY-1250 запланирован на 22.10, а PAY-1265 ещё в тестировании из-за стенда ift-2. Нужна оценка: успеваем или переносим?" },
    { id: "s6", level: "yellow", category: "release", text: "PAY-1259 готова к выводу, но не привязана ни к одному Release 2.0", owner: "Иван Петров", age_days: 2, url: "#",
      reminder: "Иван, PAY-1259 в статусе «Готово к выводу», но не привязана к тикету Release 2.0. Привяжи, пожалуйста, к ближайшему релизу или заведи новый." },
    { id: "s7", level: "yellow", category: "people", text: "Елена Волкова в отпуске до 26.10, PAY-1284 без заменяющего", owner: "Техлид", age_days: 4, url: "#",
      reminder: "Коллеги, Елена в отпуске до 26.10, требования к рассрочке (PAY-1284) стоят. Нужен заменяющий или явный перенос в следующий спринт." },
    { id: "s8", level: "yellow", category: "coverage", text: "Покрытие pay-core 61% при цели 70%, −2 п.п. к прошлому спринту", owner: "Дмитрий Соколов", age_days: 0, url: "#",
      reminder: "Дмитрий, автоматизация pay-core упала до 61% (цель 70%). Новые кейсы по возвратам СБП без автотестов — заложим в следующий спринт?" }
  ],
  prs: [
    { repo: "pay-core", id: 807, title: "Идемпотентность платёжных callback-ов", author: "Анна Смирнова", reviewers: ["Иван Петров"], age_days: 5, idle_days: 3, whose_turn: "reviewers", last_human_activity: "2026-10-15 17:20 · Анна: ответила на замечания", build: "ok", jira_key: "PAY-1262", url: "#" },
    { repo: "pay-limits", id: 233, title: "PAY-1280 миграция limits", author: "Анна Смирнова", reviewers: ["Олег Кузнецов", "Иван Петров"], age_days: 2, idle_days: 1, whose_turn: "author", last_human_activity: "2026-10-19 11:05 · Олег: needs work", build: "failed", jira_key: "PAY-1280", url: "#" },
    { repo: "pay-core", id: 812, title: "PAY-1271 REFUND_PENDING для СБП", author: "Иван Петров", reviewers: ["Анна Смирнова"], age_days: 1, idle_days: 0, whose_turn: "reviewers", last_human_activity: "2026-10-20 08:50 · Иван: push", build: "ok", jira_key: "PAY-1271", url: "#" },
    { repo: "pay-autotests", id: 145, title: "Тесты на возвраты СБП", author: "Дмитрий Соколов", reviewers: ["Мария Иванова"], age_days: 0, idle_days: 0, whose_turn: "reviewers", last_human_activity: "2026-10-20 09:10 · Дмитрий: создал PR", build: "running", jira_key: null, url: "#" }
  ],
  releases: {
    upcoming: [
      { key: "PAY-1250", title: "Release 2.0: выплаты самозанятым", planned_date: "2026-10-22", status: "Подготовка", days_no_move: 1, linked: ["PAY-1265", "PAY-1258"], issues: ["PAY-1265 ещё в тестировании"], url: "#" },
      { key: "PAY-1291", title: "Release 2.0: возвраты СБП", planned_date: "2026-10-29", status: "Открыт", days_no_move: 0, linked: [], issues: ["нет связанных задач"], url: "#" }
    ],
    past: [
      { key: "PAY-1231", title: "Release 2.0: лимиты по картам v1", planned_date: "2026-10-08", closed_date: "2026-10-08", status: "Выведен", linked: ["PAY-1210", "PAY-1214", "PAY-1220"], issues: [], url: "#" },
      { key: "PAY-1240", title: "Release 2.0: комиссия эквайринга", planned_date: "2026-10-15", closed_date: null, status: "Ожидает вывода", linked: ["PAY-1236"], issues: ["дата прошла, тикет открыт"], url: "#" }
    ],
    ready_without_release: [
      { key: "PAY-1259", title: "Новый формат реестра выплат", assignee: "Иван Петров", url: "#" }
    ]
  },
  tests: {
    jobs: [],
    launches: [
      { project: "pay-core", name: "pay-smoke #418", passed: 106, failed: 11, broken: 3, skipped: 0, url: "#" },
      { project: "pay-core", name: "pay-regress #97 (ночной)", passed: 1182, failed: 24, broken: 6, skipped: 18, url: "#" },
      { project: "pay-limits", name: "limits-regress #61", passed: 312, failed: 0, broken: 0, skipped: 2, url: "#" }
    ],
    failures: [
      { test: "PaymentCallbackTest.duplicateCallbackIgnored", project: "pay-core", is_new: true, flaky_rate: 0, short_cause: "окружение: ift-2 недоступен (Connection refused)", url: "#" },
      { test: "SbpRefundTest.refundPendingStatus", project: "pay-core", is_new: true, flaky_rate: 0, short_cause: "баг продукта: статус REFUND_PENDING не возвращается API", url: "#" },
      { test: "PayoutSelfEmployedTest.receiptSent", project: "pay-core", is_new: false, flaky_rate: 0.4, short_cause: "flaky: таймаут ожидания чека 5 с", url: "#" },
      { test: "CommissionTest.roundingHalfUp", project: "pay-core", is_new: true, flaky_rate: 0, short_cause: null, url: "#" }
    ]
  },
  coverage: {
    projects: [
      { name: "pay-core", automated: 732, total: 1200, pct: 61, target: 70, delta_prev: -2 },
      { name: "pay-limits", automated: 214, total: 260, pct: 82, target: 70, delta_prev: 3 }
    ]
  },
  recommendations: [
    { who: "Олег Кузнецов", what: "Забрать PAY-1268 у Анны", when: "сегодня", why: "у Олега пусто, у Анны 3 задачи и одна стоит 3 дня" },
    { who: "Иван Петров", what: "Провести ревью pay-core#807", when: "до 13:00", why: "PR висит 3 дня, блокирует PAY-1262 и релиз PAY-1250" },
    { who: "Дмитрий Соколов + DevOps", what: "Поднять стенд ift-2 и перезапустить smoke", when: "до обеда", why: "9 из 14 падений smoke — Connection refused к ift-2; от него же блокер у Марии" },
    { who: "Мария Иванова", what: "Дать оценку готовности PAY-1250", when: "завтра до 12:00", why: "вывод 22.10, а PAY-1265 не протестирована" },
    { who: "Техлид", what: "Назначить заменяющего на PAY-1284 или перенести", when: "сегодня", why: "Елена в отпуске до 26.10" }
  ]
};

window.TESTS_REPORT = {
  meta: { generated_at: "2026-10-20T08:55:00+03:00", generated_by: "Дмитрий Соколов (aqa)", launches: ["pay-smoke #418", "pay-regress #97"] },
  clusters: [
    { signature: "java.net.ConnectException: Connection refused (ift-2.pay.local:8443)", category: "окружение",
      cause: "Стенд ift-2 не отвечает с 19.10 ~18:00. Все тесты, которые ходят в платёжный шлюз, падают на подключении.",
      count: 9, jira_bug: null, suggested_bug: null,
      jenkins_log_excerpt: "[pay-smoke #418] 08:12:41 ERROR ConnectException: Connection refused\n  at PaymentGatewayClient.send(PaymentGatewayClient.java:88)",
      tests: [ { name: "PaymentCallbackTest.duplicateCallbackIgnored", url: "#" }, { name: "PaymentCallbackTest.signatureValid", url: "#" }, { name: "PayoutTest.createPayout", url: "#" } ] },
    { signature: "AssertionError: expected status REFUND_PENDING but was PROCESSING", category: "баг продукта",
      cause: "После мержа PAY-1271 в ветку релиза API возвратов не отдаёт новый статус — маппинг в RefundStatusMapper не обновлён.",
      count: 3, jira_bug: null,
      suggested_bug: { title: "API возвратов СБП не возвращает статус REFUND_PENDING", description: "Шаги: создать возврат по СБП → GET /refunds/{id}. Ожидается REFUND_PENDING, фактически PROCESSING. Тесты: SbpRefundTest.*" },
      jenkins_log_excerpt: null,
      tests: [ { name: "SbpRefundTest.refundPendingStatus", url: "#" }, { name: "SbpRefundTest.refundListFilter", url: "#" }, { name: "SbpRefundTest.refundWebhook", url: "#" } ] },
    { signature: "TimeoutException: receipt not received in 5000 ms", category: "flaky",
      cause: "Падает в 4 из 10 последних прогонов. Чек приходит за 5–7 с, таймаут теста 5 с.",
      count: 1, jira_bug: { key: "PAY-1199", url: "#" }, suggested_bug: null, jenkins_log_excerpt: null,
      tests: [ { name: "PayoutSelfEmployedTest.receiptSent", url: "#" } ] },
    { signature: "AssertionError: expected 10.51 but was 10.50", category: "ошибка теста",
      cause: "После хотфикса PAY-1290 округление комиссии стало банковским (HALF_EVEN), тест ожидает HALF_UP.",
      count: 1, jira_bug: null, suggested_bug: null, jenkins_log_excerpt: null,
      tests: [ { name: "CommissionTest.roundingHalfUp", url: "#" } ] }
  ]
};
