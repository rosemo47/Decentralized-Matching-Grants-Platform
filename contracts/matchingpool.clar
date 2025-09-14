(define-constant ERR-NOT-AUTHORIZED u100)
(define-constant ERR-INSUFFICIENT-POOL u101)
(define-constant ERR-INVALID-CAMPAIGN u102)
(define-constant ERR-INVALID-AMOUNT u103)
(define-constant ERR-INVALID-RATIO u104)
(define-constant ERR-INVALID-CAP u105)
(define-constant ERR-CAMPAIGN-NOT-ACTIVE u106)
(define-constant ERR-MAX-MATCHED-EXCEEDED u107)
(define-constant ERR-INVALID-TIMESTAMP u108)
(define-constant ERR-AUTHORITY-NOT-VERIFIED u109)
(define-constant ERR-INVALID-PENALTY u110)
(define-constant ERR-INVALID-WITHDRAWAL u111)
(define-constant ERR-POOL-UPDATE-NOT-ALLOWED u112)
(define-constant ERR-INVALID-UPDATE-PARAM u113)
(define-constant ERR-MAX-POOLS-EXCEEDED u114)
(define-constant ERR-INVALID-POOL-TYPE u115)
(define-constant ERR-INVALID-INTEREST u116)
(define-constant ERR-INVALID-GRACE u117)
(define-constant ERR-INVALID-LOCATION u118)
(define-constant ERR-INVALID-CURRENCY u119)
(define-constant ERR-INVALID-STATUS u120)
(define-constant ERR-INVALID-MIN-DEPOSIT u121)
(define-constant ERR-INVALID-MAX-DEPOSIT u122)

(define-constant DEFAULT-MATCHING-RATIO u2)
(define-constant DEFAULT-MAX-MATCHING-CAP u1000000000)
(define-constant DEFAULT-PENALTY-RATE u5)

(define-data-var pool-balance uint u0)
(define-data-var total-matched uint u0)
(define-data-var next-pool-id uint u0)
(define-data-var max-pools uint u100)
(define-data-var admin-fee uint u100)
(define-data-var authority-contract (optional principal) none)
(define-data-var matching-ratio uint DEFAULT-MATCHING-RATIO)
(define-data-var max-matching-cap uint DEFAULT-MAX-MATCHING-CAP)
(define-data-var penalty-rate uint DEFAULT-PENALTY-RATE)

(define-map campaign-matches
  { campaign-id: uint }
  {
    matched-amount: uint,
    is-active: bool,
    timestamp: uint,
    total-donations: uint,
    pool-type: (string-utf8 50),
    interest: uint,
    grace: uint,
    location: (string-utf8 100),
    currency: (string-utf8 20),
    status: bool,
    min-deposit: uint,
    max-deposit: uint
  }
)

(define-map pools-by-campaign
  { campaign-name: (string-utf8 100) }
  uint)

(define-map pool-updates
  uint
  {
    update-ratio: uint,
    update-cap: uint,
    update-timestamp: uint,
    updater: principal
  }
)

(define-read-only (get-pool-balance)
  (ok (var-get pool-balance))
)

(define-read-only (get-total-matched)
  (ok (var-get total-matched))
)

(define-read-only (get-campaign-match (id uint))
  (map-get? campaign-matches { campaign-id: id })
)

(define-read-only (get-pool-updates (id uint))
  (map-get? pool-updates id)
)

(define-read-only (is-campaign-registered (name (string-utf8 100)))
  (is-some (map-get? pools-by-campaign { campaign-name: name }))
)

(define-private (validate-amount (amount uint))
  (if (> amount u0)
      (ok true)
      (err ERR-INVALID-AMOUNT))
)

(define-private (validate-ratio (ratio uint))
  (if (and (> ratio u0) (<= ratio u10))
      (ok true)
      (err ERR-INVALID-RATIO))
)

(define-private (validate-cap (cap uint))
  (if (> cap u0)
      (ok true)
      (err ERR-INVALID-CAP))
)

(define-private (validate-timestamp (ts uint))
  (if (>= ts block-height)
      (ok true)
      (err ERR-INVALID-TIMESTAMP))
)

(define-private (validate-pool-type (type (string-utf8 50)))
  (if (or (is-eq type u"charity") (is-eq type u"grant") (is-eq type u"fund"))
      (ok true)
      (err ERR-INVALID-POOL-TYPE))
)

(define-private (validate-interest (rate uint))
  (if (<= rate u20)
      (ok true)
      (err ERR-INVALID-INTEREST))
)

(define-private (validate-grace (period uint))
  (if (<= period u30)
      (ok true)
      (err ERR-INVALID-GRACE))
)

(define-private (validate-location (loc (string-utf8 100)))
  (if (and (> (len loc) u0) (<= (len loc) u100))
      (ok true)
      (err ERR-INVALID-LOCATION))
)

(define-private (validate-currency (cur (string-utf8 20)))
  (if (or (is-eq cur u"STX") (is-eq cur u"USD") (is-eq cur u"BTC"))
      (ok true)
      (err ERR-INVALID-CURRENCY))
)

(define-private (validate-min-deposit (min uint))
  (if (> min u0)
      (ok true)
      (err ERR-INVALID-MIN-DEPOSIT))
)

(define-private (validate-max-deposit (max uint))
  (if (> max u0)
      (ok true)
      (err ERR-INVALID-MAX-DEPOSIT))
)

(define-private (validate-principal (p principal))
  (if (not (is-eq p tx-sender))
      (ok true)
      (err ERR-NOT-AUTHORIZED))
)

(define-public (set-authority-contract (contract-principal principal))
  (begin
    (try! (validate-principal contract-principal))
    (asserts! (is-none (var-get authority-contract)) (err ERR-AUTHORITY-NOT-VERIFIED))
    (var-set authority-contract (some contract-principal))
    (ok true)
  )
)

(define-public (set-max-pools (new-max uint))
  (begin
    (asserts! (> new-max u0) (err ERR-INVALID-UPDATE-PARAM))
    (asserts! (is-some (var-get authority-contract)) (err ERR-AUTHORITY-NOT-VERIFIED))
    (var-set max-pools new-max)
    (ok true)
  )
)

(define-public (set-admin-fee (new-fee uint))
  (begin
    (asserts! (>= new-fee u0) (err ERR-INVALID-UPDATE-PARAM))
    (asserts! (is-some (var-get authority-contract)) (err ERR-AUTHORITY-NOT-VERIFIED))
    (var-set admin-fee new-fee)
    (ok true)
  )
)

(define-public (fund-pool (amount uint))
  (begin
    (try! (validate-amount amount))
    (try! (stx-transfer? amount tx-sender (as-contract tx-sender)))
    (var-set pool-balance (+ (var-get pool-balance) amount))
    (print { event: "pool-funded", amount: amount, sender: tx-sender })
    (ok true)
  )
)

(define-public (create-campaign-pool
  (campaign-name (string-utf8 100))
  (pool-type (string-utf8 50))
  (interest uint)
  (grace uint)
  (location (string-utf8 100))
  (currency (string-utf8 20))
  (min-deposit uint)
  (max-deposit uint)
)
  (let (
        (next-id (var-get next-pool-id))
        (current-max (var-get max-pools))
        (authority (var-get authority-contract))
      )
    (asserts! (< next-id current-max) (err ERR-MAX-POOLS-EXCEEDED))
    (try! (validate-pool-type pool-type))
    (try! (validate-interest interest))
    (try! (validate-grace grace))
    (try! (validate-location location))
    (try! (validate-currency currency))
    (try! (validate-min-deposit min-deposit))
    (try! (validate-max-deposit max-deposit))
    (asserts! (is-none (map-get? pools-by-campaign { campaign-name: campaign-name })) (err ERR-INVALID-CAMPAIGN))
    (let ((authority-recipient (unwrap! authority (err ERR-AUTHORITY-NOT-VERIFIED))))
      (try! (stx-transfer? (var-get admin-fee) tx-sender authority-recipient))
    )
    (map-set campaign-matches { campaign-id: next-id }
      {
        matched-amount: u0,
        is-active: true,
        timestamp: block-height,
        total-donations: u0,
        pool-type: pool-type,
        interest: interest,
        grace: grace,
        location: location,
        currency: currency,
        status: true,
        min-deposit: min-deposit,
        max-deposit: max-deposit
      }
    )
    (map-set pools-by-campaign { campaign-name: campaign-name } next-id)
    (var-set next-pool-id (+ next-id u1))
    (print { event: "pool-created", id: next-id })
    (ok next-id)
  )
)

(define-public (match-donation (campaign-id uint) (donation-amount uint))
  (let (
        (campaign (unwrap! (map-get? campaign-matches { campaign-id: campaign-id }) (err ERR-INVALID-CAMPAIGN)))
        (match-amount (* donation-amount (var-get matching-ratio)))
        (available-balance (var-get pool-balance))
        (new-matched (+ (get matched-amount campaign) match-amount))
        (new-total-donations (+ (get total-donations campaign) donation-amount))
      )
    (asserts! (get is-active campaign) (err ERR-CAMPAIGN-NOT-ACTIVE))
    (asserts! (<= match-amount (var-get max-matching-cap)) (err ERR-MAX-MATCHED-EXCEEDED))
    (asserts! (>= available-balance match-amount) (err ERR-INSUFFICIENT-POOL))
    (try! (validate-amount donation-amount))
    (try! (as-contract (stx-transfer? match-amount (as-contract tx-sender) tx-sender)))
    (var-set pool-balance (- available-balance match-amount))
    (var-set total-matched (+ (var-get total-matched) match-amount))
    (map-set campaign-matches { campaign-id: campaign-id }
      (merge campaign
        {
          matched-amount: new-matched,
          total-donations: new-total-donations,
          timestamp: block-height
        }
      )
    )
    (print { event: "donation-matched", campaign-id: campaign-id, match-amount: match-amount })
    (ok match-amount)
  )
)

(define-public (update-pool-ratio (new-ratio uint))
  (begin
    (asserts! (is-some (var-get authority-contract)) (err ERR-AUTHORITY-NOT-VERIFIED))
    (try! (validate-ratio new-ratio))
    (var-set matching-ratio new-ratio)
    (print { event: "pool-ratio-updated", new-ratio: new-ratio })
    (ok true)
  )
)

(define-public (withdraw-from-pool (amount uint))
  (begin
    (asserts! (is-eq tx-sender (unwrap! (var-get authority-contract) (err ERR-AUTHORITY-NOT-VERIFIED))) (err ERR-NOT-AUTHORIZED))
    (try! (validate-amount amount))
    (asserts! (>= (var-get pool-balance) amount) (err ERR-INSUFFICIENT-POOL))
    (try! (as-contract (stx-transfer? amount (as-contract tx-sender) tx-sender)))
    (var-set pool-balance (- (var-get pool-balance) amount))
    (print { event: "pool-withdrawal", amount: amount })
    (ok true)
  )
)

(define-public (deactivate-campaign (campaign-id uint))
  (let (
        (campaign (unwrap! (map-get? campaign-matches { campaign-id: campaign-id }) (err ERR-INVALID-CAMPAIGN)))
      )
    (asserts! (is-eq tx-sender (unwrap! (var-get authority-contract) (err ERR-AUTHORITY-NOT-VERIFIED))) (err ERR-NOT-AUTHORIZED))
    (map-set campaign-matches { campaign-id: campaign-id }
      (merge campaign { is-active: false, status: false })
    )
    (print { event: "campaign-deactivated", id: campaign-id })
    (ok true)
  )
)

(define-public (get-pool-count)
  (ok (var-get next-pool-id))
)

(define-public (check-campaign-existence (name (string-utf8 100)))
  (ok (is-campaign-registered name))
)