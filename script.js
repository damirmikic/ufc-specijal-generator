class MMAOddsApp {
    constructor() {
        this.matches = [];
        this.selectedMatchOdds = null;
        this.selectedMatchId = null;
        this.csvMarkets = [];
        this.isLoading = false;
        this.isLoadingOdds = false;
        this.isEditMode = false;
        this.editableData = [];

        this.initializeElements();
        this.bindEvents();
    }

    initializeElements() {
        this.fetchBtn = document.getElementById('fetchBtn');
        this.exportBtn = document.getElementById('exportBtn');
        this.clearBtn = document.getElementById('clearBtn');
        this.spinner = document.getElementById('spinner');
        this.stats = document.getElementById('stats');
        this.results = document.getElementById('results');
        this.noData = document.getElementById('noData');
        this.progressContainer = document.getElementById('progressContainer');
        this.progressFill = document.getElementById('progressFill');
        this.progressText = document.getElementById('progressText');
        this.matchCount = document.getElementById('matchCount');
        this.selectedMatch = document.getElementById('selectedMatch');
        this.lastUpdated = document.getElementById('lastUpdated');
        this.matchSelector = document.getElementById('matchSelector');
        this.matchDropdown = document.getElementById('matchDropdown');
        this.fetchOddsBtn = document.getElementById('fetchOddsBtn');
        this.spinnerOdds = document.getElementById('spinnerOdds');
        this.csvMarketCount = document.getElementById('csvMarketCount');
        this.previewBtn = document.getElementById('previewBtn');
        this.csvPreview = document.getElementById('csvPreview');
        this.previewTable = document.getElementById('previewTable');
        this.closePreviewBtn = document.getElementById('closePreviewBtn');
        this.editModeBtn = document.getElementById('editModeBtn');
        this.saveChangesBtn = document.getElementById('saveChangesBtn');
    }

    bindEvents() {
        this.fetchBtn.addEventListener('click', () => this.fetchMatches());
        this.exportBtn.addEventListener('click', () => this.exportToCSV());
        this.clearBtn.addEventListener('click', () => this.clearData());
        this.matchDropdown.addEventListener('change', () => this.onMatchSelect());
        this.fetchOddsBtn.addEventListener('click', () => this.fetchSelectedMatchOdds());
        this.previewBtn.addEventListener('click', () => this.showCSVPreview());
        this.closePreviewBtn.addEventListener('click', () => this.hideCSVPreview());
        this.editModeBtn.addEventListener('click', () => this.toggleEditMode());
        this.saveChangesBtn.addEventListener('click', () => this.savePreviewChanges());
    }

    async fetchMatches() {
        if (this.isLoading) return;

        this.isLoading = true;
        this.setLoadingState(true);
        this.showProgress(true);

        try {
            this.updateProgress(10, 'Fetching matches...');

            const url = 'https://eu1.offering-api.kambicdn.com/offering/v2018/kambi/listView/ufc_mma/ufc/all/all/matches.json';
            const params = new URLSearchParams({
                channel_id: '7',
                client_id: '2',
                lang: 'en_GB',
                market: 'GB',
                useCombined: 'true',
                useCombinedLive: 'true'
            });

            const response = await fetch(`${url}?${params}`);
            if (!response.ok) throw new Error(`HTTP ${response.status}`);

            const data = await response.json();
            this.matches = [];

            if (data.events) {
                this.matches = data.events.map(eventData => ({
                    id: eventData.event.id,
                    name: eventData.event.name,
                    homeName: eventData.event.homeName,
                    awayName: eventData.event.awayName,
                    start: eventData.event.start,
                    group: eventData.event.group
                }));
            }

            this.updateProgress(100, `Found ${this.matches.length} matches`);
            this.populateMatchDropdown();
            this.updateStats();
            this.clearResults();

        } catch (error) {
            console.error('Error fetching matches:', error);
            this.showError('Failed to fetch matches. Please try again.');
        } finally {
            this.isLoading = false;
            this.setLoadingState(false);
            this.showProgress(false);
        }
    }

    populateMatchDropdown() {
        this.matchDropdown.innerHTML = '<option value="">Choose a match...</option>';

        this.matches.forEach(match => {
            const option = document.createElement('option');
            option.value = match.id;
            option.textContent = `${match.name} - ${new Date(match.start).toLocaleDateString()}`;
            this.matchDropdown.appendChild(option);
        });

        this.matchSelector.style.display = this.matches.length > 0 ? 'flex' : 'none';
    }

    onMatchSelect() {
        const selectedId = this.matchDropdown.value;
        this.fetchOddsBtn.disabled = !selectedId;

        if (!selectedId) {
            this.selectedMatchId = null;
            this.selectedMatchOdds = null;
            this.clearResults();
            this.updateSelectedMatchStats();
        }
    }

    async fetchSelectedMatchOdds() {
        if (this.isLoadingOdds || !this.matchDropdown.value) return;

        this.isLoadingOdds = true;
        this.setOddsLoadingState(true);
        this.selectedMatchId = this.matchDropdown.value;

        try {
            const selectedMatch = this.matches.find(m => m.id == this.selectedMatchId);
            this.selectedMatchOdds = await this.fetchMatchOdds(this.selectedMatchId);
            this.displaySelectedMatchOdds(selectedMatch, this.selectedMatchOdds);
            this.updateSelectedMatchStats();
            this.exportBtn.disabled = false;

        } catch (error) {
            console.error('Error fetching odds:', error);
            this.showError('Failed to fetch odds for selected match. Please try again.');
        } finally {
            this.isLoadingOdds = false;
            this.setOddsLoadingState(false);
        }
    }

    displaySelectedMatchOdds(match, odds) {
        if (!match || !odds) {
            this.results.innerHTML = '<div class="no-data"><p>No odds data available</p></div>';
            return;
        }

        const matchCard = this.createMatchCard(match, odds);
        this.results.innerHTML = '';
        this.results.appendChild(matchCard);
    }

    clearResults() {
        this.results.innerHTML = '<div class="no-data"><p>Select a match from the dropdown to view odds</p></div>';
    }

    async fetchMatchOdds(matchId) {
        const url = `https://eu1.offering-api.kambicdn.com/offering/v2018/kambi/betoffer/event/${matchId}.json`;
        const params = new URLSearchParams({
            lang: 'en_GB',
            market: 'GB',
            client_id: '2',
            channel_id: '7',
            includeParticipants: 'true'
        });

        const response = await fetch(`${url}?${params}`);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);

        const data = await response.json();
        return this.parseOddsData(data);
    }

    parseOddsData(oddsData) {
        const parsedOdds = [];

        if (oddsData.betOffers) {
            for (const betOffer of oddsData.betOffers) {
                if (betOffer.outcomes) {
                    const betInfo = {
                        betType: betOffer.criterion?.label || 'Unknown',
                        betOfferId: betOffer.id,
                        betOfferTypeId: betOffer.betOfferType?.id,
                        line: betOffer.line,
                        outcomes: betOffer.outcomes.map(outcome => ({
                            participant: outcome.participant || 'Unknown',
                            odds: outcome.odds ? (outcome.odds / 1000) : 0,
                            label: outcome.label || 'Unknown',
                            outcomeId: outcome.id,
                            type: outcome.type,
                            line: outcome.line // Individual outcome line (for over/under)
                        }))
                    };

                    // Debug logging for significant strikes during parsing
                    if (betOffer.criterion?.label && betOffer.criterion.label.toLowerCase().includes('significant strikes')) {
                        console.log('=== PARSING SIGNIFICANT STRIKES ===');
                        console.log('Raw criterion.label:', betOffer.criterion.label);
                        console.log('Extracted betType:', betInfo.betType);
                        console.log('=== END PARSING DEBUG ===');
                    }
                    parsedOdds.push(betInfo);
                }
            }
        }

        return parsedOdds;
    }
    displayResults() {
        if (this.allOddsData.length === 0) {
            this.results.innerHTML = '<div class="no-data"><p>No data available</p></div>';
            return;
        }

        const matchesGrid = document.createElement('div');
        matchesGrid.className = 'matches-grid';

        this.allOddsData.forEach(({ match, odds }) => {
            const matchCard = this.createMatchCard(match, odds);
            matchesGrid.appendChild(matchCard);
        });

        this.results.innerHTML = '';
        this.results.appendChild(matchesGrid);
    }

    createMatchCard(match, odds) {
        const card = document.createElement('div');
        card.className = 'match-card';

        const startTime = new Date(match.start).toLocaleString();

        card.innerHTML = `
            <div class="match-header">
                <div class="match-name">${match.name}</div>
                <div class="match-details">
                    ${match.group} • ${startTime}
                </div>
            </div>
            <div class="odds-container">
                ${odds.length > 0 ? this.createOddsHTML(odds) : '<p>No odds available</p>'}
            </div>
        `;

        return card;
    }

    groupAndSortMarkets(odds) {
        // Create groups based on similar market names
        const groups = {};
        const groupOrder = [
            'moneyline', 'winner', 'match',
            'winning', 'round', 'method', 'finish',
            'over', 'under', 'total',
            'prop', 'special'
        ];

        odds.forEach((betType, originalIndex) => {
            const cleanName = betType.betType.toLowerCase();
            let groupKey = 'other';

            // Determine group based on market name
            if (cleanName.includes('moneyline') || cleanName.includes('winner') || cleanName.includes('to win')) {
                groupKey = 'moneyline';
            } else if (cleanName.includes('winning combinations') || cleanName.includes('winning combination')) {
                groupKey = 'winning';
            } else if (cleanName.includes('round') || cleanName.includes('distance')) {
                groupKey = 'round';
            } else if (cleanName.includes('method') || cleanName.includes('finish') || cleanName.includes('decision')) {
                groupKey = 'method';
            } else if (cleanName.includes('over') || cleanName.includes('under') || cleanName.includes('total')) {
                groupKey = 'total';
            } else if (cleanName.includes('prop') || cleanName.includes('special')) {
                groupKey = 'prop';
            }

            if (!groups[groupKey]) {
                groups[groupKey] = [];
            }
            groups[groupKey].push({ ...betType, originalIndex });
        });

        // Sort within each group by market name
        Object.keys(groups).forEach(groupKey => {
            groups[groupKey].sort((a, b) => a.betType.localeCompare(b.betType));
        });

        // Return sorted markets maintaining original structure
        const sortedMarkets = [];
        groupOrder.forEach(groupKey => {
            if (groups[groupKey]) {
                sortedMarkets.push(...groups[groupKey]);
            }
        });

        // Add any remaining groups not in the predefined order
        Object.keys(groups).forEach(groupKey => {
            if (!groupOrder.includes(groupKey)) {
                sortedMarkets.push(...groups[groupKey]);
            }
        });

        return sortedMarkets;
    }

    createOddsHTML(odds) {
        const sortedOdds = this.groupAndSortMarkets(odds);
        let currentGroup = '';

        return sortedOdds.map((betType, index) => {
            const isOverUnder = betType.betOfferTypeId === 6;
            // Get line from outcomes if available, fallback to betOffer line
            let line = null;
            if (isOverUnder) {
                const overOutcome = betType.outcomes.find(o => o.type === 'OT_OVER');
                const underOutcome = betType.outcomes.find(o => o.type === 'OT_UNDER');
                if (overOutcome && overOutcome.line) {
                    line = (overOutcome.line / 1000).toFixed(1);
                } else if (underOutcome && underOutcome.line) {
                    line = (underOutcome.line / 1000).toFixed(1);
                } else if (betType.line) {
                    line = (betType.line / 1000).toFixed(1);
                }
            }

            // Determine group for visual separation
            const cleanName = betType.betType.toLowerCase();
            let groupName = '';
            if (cleanName.includes('moneyline') || cleanName.includes('winner') || cleanName.includes('to win')) {
                groupName = 'Match Winner';
            } else if (cleanName.includes('winning combinations') || cleanName.includes('winning combination')) {
                groupName = 'Winning Combinations';
            } else if (cleanName.includes('round') || cleanName.includes('distance')) {
                groupName = 'Round & Distance';
            } else if (cleanName.includes('method') || cleanName.includes('finish') || cleanName.includes('decision')) {
                groupName = 'Method of Victory';
            } else if (cleanName.includes('over') || cleanName.includes('under') || cleanName.includes('total')) {
                groupName = 'Totals';
            } else if (cleanName.includes('prop') || cleanName.includes('special')) {
                groupName = 'Props & Specials';
            } else {
                groupName = 'Other Markets';
            }

            // Check if we need to show group header
            let groupHeader = '';
            if (currentGroup !== groupName) {
                currentGroup = groupName;
                groupHeader = `<div class="market-group-header">${groupName}</div>`;
            }

            const marketId = `${this.selectedMatchId}_${betType.betOfferId}`;
            const isAdded = this.csvMarkets.some(m => m.marketId === marketId);

            return `
                ${groupHeader}
                <div class="bet-type">
                    <div class="bet-type-header">
                        <div class="bet-type-title">${betType.betType}</div>
                        <button class="add-market-btn ${isAdded ? 'added' : ''}" 
                                onclick="app.addMarketToCSV('${marketId}', ${betType.originalIndex || index})"
                                ${isAdded ? 'disabled' : ''}>
                            ${isAdded ? '✓ Added' : '+ Add to CSV'}
                        </button>
                    </div>
                    ${isOverUnder && line ? `<div class="over-under-info">Over/Under Line: ${line}</div>` : ''}
                    <div class="outcomes">
                        ${betType.outcomes.map(outcome => `
                            <div class="outcome">
                                <span class="outcome-label">${outcome.label}</span>
                                <span class="outcome-odds">${outcome.odds.toFixed(2)}</span>
                            </div>
                        `).join('')}
                    </div>
                </div>
            `;
        }).join('');
    }

    addMarketToCSV(marketId, betTypeIndex) {
        if (this.csvMarkets.some(m => m.marketId === marketId)) {
            return; // Already added
        }

        const selectedMatch = this.matches.find(m => m.id == this.selectedMatchId);
        const betType = this.selectedMatchOdds[betTypeIndex];

        if (!selectedMatch || !betType) return;

        const marketData = {
            marketId: marketId,
            match: selectedMatch,
            betType: betType
        };

        this.csvMarkets.push(marketData);
        this.updateCSVMarketCount();
        this.refreshOddsDisplay();
    }

    generateCSVData() {
        if (this.csvMarkets.length === 0) {
            return [];
        }

        console.log('=== CSV GENERATION START ===');
        console.log('Total markets in csvMarkets:', this.csvMarkets.length);
        this.csvMarkets.forEach((market, index) => {
            console.log(`Market ${index + 1}:`, market.betType.betType);
        });
        console.log('=== END CSV GENERATION START ===');

        const csvRows = [];

        // Add MATCH_NAME row (A2)
        if (this.csvMarkets.length > 0) {
            const firstMatch = this.csvMarkets[0].match;
            csvRows.push({
                'Datum': '',
                'Vreme': '',
                'Sifra': '',
                'Domacin': `MATCH_NAME:${firstMatch.name}`,
                'Gost': '',
                '1': '',
                'X': '',
                '2': '',
                'GR': '',
                'U': '',
                'O': '',
                'Yes': '',
                'No': '',
                '_isMatchName': true
            });
        }

        // Group markets by cleaned betType for LEAGUE_NAME and process all markets
        const marketGroups = {};
        this.csvMarkets.forEach(({ match, betType }) => {
            const cleanLeagueName = this.getCleanLeagueName(betType.betType, match);
            if (!marketGroups[cleanLeagueName]) {
                marketGroups[cleanLeagueName] = [];
            }
            marketGroups[cleanLeagueName].push({ match, betType });
        });

        // Process each market group - add LEAGUE_NAME header, then all market data rows
        Object.keys(marketGroups).forEach(leagueName => {
            // Add LEAGUE_NAME row as section header
            csvRows.push({
                'Datum': '',
                'Vreme': '',
                'Sifra': '',
                'Domacin': `LEAGUE_NAME:${leagueName}`,
                'Gost': '',
                '1': '',
                'X': '',
                '2': '',
                'GR': '',
                'U': '',
                'O': '',
                'Yes': '',
                'No': '',
                '_isLeagueName': true
            });

            // Process all markets in this league group
            marketGroups[leagueName].forEach(({ match, betType }) => {
                const matchDate = new Date(match.start);
                const datum = matchDate.toLocaleDateString('en-GB'); // DD/MM/YYYY format
                const vreme = matchDate.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });

                // Extract clean market name - remove fighter names if they exist in the market name
                // BUT preserve fighter names for significant strikes markets
                let cleanMarketName = betType.betType;

                // Skip fighter name removal for significant strikes markets
                const isSignificantStrikesMarket = betType.betType.toLowerCase().includes('significant strikes');

                // Remove fighter names from market name if they exist (but not for significant strikes)
                if (!isSignificantStrikesMarket) {
                    const fighterNames = [match.homeName, match.awayName];
                    fighterNames.forEach(fighterName => {
                        if (fighterName && fighterName !== 'Unknown') {
                            // Remove variations like "by Fighter Name", "Fighter Name to", etc.
                            const patterns = [
                                new RegExp(`\\s*by\\s+${fighterName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*`, 'gi'),
                                new RegExp(`\\s*${fighterName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s+to\\s*`, 'gi'),
                                new RegExp(`\\s*${fighterName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*`, 'gi')
                            ];
                            patterns.forEach(pattern => {
                                cleanMarketName = cleanMarketName.replace(pattern, ' ').trim();
                            });
                        }
                    });

                    // Clean up extra spaces
                    cleanMarketName = cleanMarketName.replace(/\s+/g, ' ').trim();

                    // If market name becomes empty or too short, use original
                    if (cleanMarketName.length < 3) {
                        cleanMarketName = betType.betType;
                    }
                }

                // Create base row structure according to your specifications
                const baseRow = {
                    'Datum': datum,
                    'Vreme': vreme,
                    'Sifra': '', // Empty as requested
                    'Domacin': cleanMarketName, // Clean market name without fighter names
                    'Gost': 'DA', // Always "DA" as requested
                    '1': '', // Will be filled with market odds
                    'X': '', // Empty
                    '2': '', // Empty
                    'GR': '', // Line for over/under (bettype id 6)
                    'U': '', // Under odds
                    'O': '', // Over odds
                    'Yes': '', // Empty
                    'No': '' // Empty
                };

                // Handle different bet types according to your specifications
                if (betType.betOfferTypeId === 6) {
                    // Over/Under markets - extract line and odds properly
                    let line = '';

                    betType.outcomes.forEach(outcome => {
                        if (outcome.type === 'OT_OVER') {
                            baseRow['O'] = outcome.odds.toFixed(2);
                            if (outcome.line) {
                                line = (outcome.line / 1000).toFixed(1);
                            }
                        } else if (outcome.type === 'OT_UNDER') {
                            baseRow['U'] = outcome.odds.toFixed(2);
                            if (outcome.line && !line) {
                                line = (outcome.line / 1000).toFixed(1);
                            }
                        }
                    });

                    // Fallback to betOffer line if outcome lines not available
                    if (!line && betType.line) {
                        line = (betType.line / 1000).toFixed(1);
                    }

                    baseRow['GR'] = line;
                    csvRows.push(baseRow);
                } else {
                    // Check if this is a "Win & Over/Under" type market
                    const isWinAndRoundsMarket = this.isWinAndRoundsMarket(betType.betType);

                    // Debug logging for Win & Rounds markets
                    if (betType.betType.toLowerCase().includes('win') &&
                        (betType.betType.toLowerCase().includes('over') || betType.betType.toLowerCase().includes('total'))) {
                        console.log('Win & Total/Over market detected:', betType.betType, 'isWinAndRoundsMarket:', isWinAndRoundsMarket);
                        console.log('Outcomes:', betType.outcomes.map(o => ({ label: o.label, participant: o.participant })));
                    }

                    // Debug logging for significant strikes markets
                    if (betType.betType.toLowerCase().includes('significant strikes')) {
                        console.log('=== SIGNIFICANT STRIKES DEBUG ===');
                        console.log('betType.betType:', betType.betType);
                        console.log('betOfferId:', betType.betOfferId);
                        console.log('betOfferTypeId:', betType.betOfferTypeId);
                        console.log('line:', betType.line);
                        console.log('Outcomes:', betType.outcomes.map(o => ({
                            label: o.label,
                            participant: o.participant,
                            odds: o.odds,
                            type: o.type
                        })));
                        console.log('=== END DEBUG ===');
                    }

                    // Debug logging for round/distance markets
                    if (betType.betType.toLowerCase().includes('round') || betType.betType.toLowerCase().includes('distance')) {
                        console.log('Round/Distance market detected:', betType.betType);
                        console.log('Outcomes:', betType.outcomes.map(o => ({ label: o.label, participant: o.participant })));
                    }

                    // Debug logging for special markets (winning combinations, winning round, alternate winning method)
                    if (betType.betType.toLowerCase().includes('winning combinations') ||
                        betType.betType.toLowerCase().includes('winning combination') ||
                        betType.betType.toLowerCase().includes('alternate winning combination') ||
                        betType.betType.toLowerCase().includes('winning round') ||
                        betType.betType.toLowerCase().includes('alternate winning method')) {
                        console.log('Special market detected:', betType.betType);
                        console.log('Outcomes:', betType.outcomes.map(o => ({ label: o.label, participant: o.participant })));
                    }

                    if (isWinAndRoundsMarket) {
                        // For "Win & Over/Under Rounds" markets, find ONLY the YES outcome
                        console.log('Processing Win & Rounds market:', betType.betType);
                        console.log('All outcomes:', betType.outcomes.map(o => ({ label: o.label, odds: o.odds })));

                        const yesOutcome = betType.outcomes.find(outcome =>
                            outcome.label.toLowerCase().includes('yes') ||
                            outcome.label.toLowerCase().includes('da') ||
                            (!outcome.label.toLowerCase().includes('no') &&
                                !outcome.label.toLowerCase().includes('ne'))
                        );

                        if (yesOutcome) {
                            console.log('Found YES outcome:', yesOutcome.label, 'odds:', yesOutcome.odds);

                            const fighterRow = {
                                'Datum': datum,
                                'Vreme': vreme,
                                'Sifra': '',
                                'Domacin': betType.betType, // Use the market name, not the outcome label
                                'Gost': 'DA',
                                '1': yesOutcome.odds.toFixed(2), // Only YES odds
                                'X': '',
                                '2': '',
                                'GR': '',
                                'U': '',
                                'O': '',
                                'Yes': '',
                                'No': ''
                            };
                            csvRows.push(fighterRow);
                        } else {
                            console.log('No YES outcome found for Win & Rounds market:', betType.betType);
                        }
                    } else {
                        // Check if this is a winning combinations market
                        const isWinningCombinationsMarket = betType.betType.toLowerCase().includes('winning combinations') ||
                            betType.betType.toLowerCase().includes('winning combination') ||
                            betType.betType.toLowerCase().includes('alternate winning combination');

                        // Check if this is a winning round market
                        const isWinningRoundMarket = betType.betType.toLowerCase().includes('winning round');

                        // Check if this is an alternate winning method market
                        const isAlternateWinningMethodMarket = betType.betType.toLowerCase().includes('alternate winning method');

                        // Check if this is a significant strikes market
                        const isSignificantStrikesMarket = betType.betType.toLowerCase().includes('significant strikes');

                        // Check if this is a round/distance market (excluding winning round which is handled separately)
                        const isRoundDistanceMarket = (betType.betType.toLowerCase().includes('round') ||
                            betType.betType.toLowerCase().includes('distance')) &&
                            !betType.betType.toLowerCase().includes('winning round');

                        if (isWinningCombinationsMarket || isWinningRoundMarket || isAlternateWinningMethodMarket) {
                            // For winning combinations, winning round, and alternate winning method markets, include ALL outcomes
                            console.log('Processing special market:', betType.betType);
                            console.log('All outcomes:', betType.outcomes.map(o => ({ label: o.label, odds: o.odds })));

                            betType.outcomes.forEach(outcome => {
                                const outcomeRow = {
                                    'Datum': datum,
                                    'Vreme': vreme,
                                    'Sifra': '',
                                    'Domacin': outcome.label, // Use specific outcome label
                                    'Gost': 'DA',
                                    '1': outcome.odds.toFixed(2), // All outcome odds
                                    'X': '',
                                    '2': '',
                                    'GR': '',
                                    'U': '',
                                    'O': '',
                                    'Yes': '',
                                    'No': ''
                                };
                                csvRows.push(outcomeRow);
                            });
                        } else if (isSignificantStrikesMarket) {
                            // For significant strikes markets, use the complete market name from criterion.label
                            // This should already contain the fighter name (e.g., "Total Significant Strikes Landed by Azamat Murzakanov")
                            console.log('=== CSV GENERATION SIGNIFICANT STRIKES ===');
                            console.log('betType.betType at CSV generation:', betType.betType);
                            console.log('betType.betOfferId:', betType.betOfferId);
                            console.log('All outcomes:', betType.outcomes.map(o => ({ label: o.label, odds: o.odds })));
                            console.log('=== END CSV GENERATION DEBUG ===');

                            // For Over/Under markets, include both Over and Under outcomes
                            betType.outcomes.forEach(outcome => {
                                console.log('Adding CSV row with Domacin:', betType.betType);
                                const outcomeRow = {
                                    'Datum': datum,
                                    'Vreme': vreme,
                                    'Sifra': '',
                                    'Domacin': betType.betType, // Use complete market name from criterion.label
                                    'Gost': outcome.label, // "Over" or "Under"
                                    '1': outcome.odds.toFixed(2),
                                    'X': '',
                                    '2': '',
                                    'GR': betType.line ? (betType.line / 1000).toFixed(1) : '', // The line value (e.g., 43.5)
                                    'U': '',
                                    'O': '',
                                    'Yes': '',
                                    'No': ''
                                };
                                csvRows.push(outcomeRow);
                            });
                        } else if (isRoundDistanceMarket) {
                            // For round/distance markets, find YES outcome and use complete market name
                            const yesOutcome = betType.outcomes.find(outcome =>
                                outcome.label.toLowerCase().includes('yes') ||
                                outcome.label.toLowerCase().includes('da') ||
                                (!outcome.label.toLowerCase().includes('no') &&
                                    !outcome.label.toLowerCase().includes('ne'))
                            );

                            if (yesOutcome) {
                                const outcomeRow = {
                                    'Datum': datum,
                                    'Vreme': vreme,
                                    'Sifra': '',
                                    'Domacin': betType.betType, // Complete market name
                                    'Gost': 'DA',
                                    '1': yesOutcome.odds.toFixed(2), // Only YES odds
                                    'X': '',
                                    '2': '',
                                    'GR': '',
                                    'U': '',
                                    'O': '',
                                    'Yes': '',
                                    'No': ''
                                };
                                csvRows.push(outcomeRow);
                            } else {
                                // If no YES/NO outcomes, include all outcomes (for specific round selections like "Round 1", "Round 2")
                                betType.outcomes.forEach(outcome => {
                                    const outcomeRow = {
                                        'Datum': datum,
                                        'Vreme': vreme,
                                        'Sifra': '',
                                        'Domacin': outcome.label, // For specific round selections, use outcome label
                                        'Gost': 'DA',
                                        '1': outcome.odds.toFixed(2),
                                        'X': '',
                                        '2': '',
                                        'GR': '',
                                        'U': '',
                                        'O': '',
                                        'Yes': '',
                                        'No': ''
                                    };
                                    csvRows.push(outcomeRow);
                                });
                            }
                        } else {
                            // For other markets, find YES outcome and use market name in Domacin
                            const yesOutcome = betType.outcomes.find(outcome =>
                                outcome.label.toLowerCase().includes('yes') ||
                                outcome.label.toLowerCase().includes('da') ||
                                (!outcome.label.toLowerCase().includes('no') &&
                                    !outcome.label.toLowerCase().includes('ne'))
                            );

                            if (yesOutcome) {
                                // Use the market name for Domacin, not the outcome label
                                let domacin = betType.betType;

                                // Clean the market name by removing fighter names
                                const fighterNames = [match.homeName, match.awayName];
                                fighterNames.forEach(fighterName => {
                                    if (fighterName && fighterName !== 'Unknown') {
                                        const patterns = [
                                            new RegExp(`\\s*by\\s+${fighterName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*`, 'gi'),
                                            new RegExp(`\\s*${fighterName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s+to\\s*`, 'gi'),
                                            new RegExp(`\\s*${fighterName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*`, 'gi')
                                        ];
                                        patterns.forEach(pattern => {
                                            domacin = domacin.replace(pattern, ' ').trim();
                                        });
                                    }
                                });

                                // Clean up extra spaces
                                domacin = domacin.replace(/\s+/g, ' ').trim();

                                // If name becomes too short, use original
                                if (domacin.length < 3) {
                                    domacin = betType.betType;
                                }

                                const outcomeRow = {
                                    'Datum': datum,
                                    'Vreme': vreme,
                                    'Sifra': '',
                                    'Domacin': betType.betType, // Complete market name, not "YES"
                                    'Gost': 'DA',
                                    '1': yesOutcome.odds.toFixed(2), // Only YES odds
                                    'X': '',
                                    '2': '',
                                    'GR': '',
                                    'U': '',
                                    'O': '',
                                    'Yes': '',
                                    'No': ''
                                };
                                csvRows.push(outcomeRow);
                            }
                        }
                    }
                }
            });
        });

        return csvRows;
    }

    exportToCSV() {
        // Use edited data if available, otherwise generate fresh data
        const csvRows = this.editableData.length > 0 ? this.editableData : this.generateCSVData();
        if (csvRows.length === 0) {
            alert('No markets added to CSV. Please add markets using the "Add to CSV" buttons.');
            return;
        }

        this.downloadCSV(csvRows);
    }

    downloadCSV(data) {
        const headers = ['Datum', 'Vreme', 'Sifra', 'Domacin', 'Gost', '1', 'X', '2', 'GR', 'U', 'O', 'Yes', 'No'];

        const csvContent = [
            headers.join(','),
            ...data.map(row => headers.map(header => {
                const value = row[header] || '';
                return `"${String(value).replace(/"/g, '""')}"`;
            }).join(','))
        ].join('\n');

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);

        link.setAttribute('href', url);
        link.setAttribute('download', `mma_odds_${new Date().toISOString().split('T')[0]}.csv`);
        link.style.visibility = 'hidden';

        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }

    showCSVPreview() {
        const csvRows = this.generateCSVData();
        if (csvRows.length === 0) {
            alert('No markets added to CSV. Please add markets using the "Add to CSV" buttons.');
            return;
        }

        this.editableData = JSON.parse(JSON.stringify(csvRows)); // Deep copy
        this.renderPreviewTable(this.editableData);
        this.csvPreview.style.display = 'block';
        this.csvPreview.scrollIntoView({ behavior: 'smooth' });

        // Reset edit mode
        this.isEditMode = false;
        this.editModeBtn.textContent = 'Enable Edit';
        this.saveChangesBtn.style.display = 'none';
    }

    hideCSVPreview() {
        this.csvPreview.style.display = 'none';
        this.isEditMode = false;
        this.editModeBtn.textContent = 'Enable Edit';
        this.saveChangesBtn.style.display = 'none';
    }

    renderPreviewTable(data) {
        const headers = ['Datum', 'Vreme', 'Sifra', 'Domacin', 'Gost', '1', 'X', '2', 'GR', 'U', 'O', 'Yes', 'No'];

        let tableHTML = '<thead><tr>';
        headers.forEach(header => {
            tableHTML += `<th>${header}</th>`;
        });
        tableHTML += '</tr></thead><tbody>';

        data.forEach((row, rowIndex) => {
            let rowClass = '';
            if (row._isMatchName) rowClass = 'match-name-row';
            else if (row._isLeagueName) rowClass = 'league-name-row';

            tableHTML += `<tr class="${rowClass}" data-row-index="${rowIndex}">`;
            headers.forEach(header => {
                const value = row[header] || '';
                const isEditable = this.isEditMode && !row._isMatchName && !row._isLeagueName;
                const editableClass = isEditable ? 'editable' : '';

                if (isEditable) {
                    tableHTML += `<td class="${editableClass}" data-header="${header}">
                        <input type="text" value="${value}" onchange="app.updateCellValue(${rowIndex}, '${header}', this.value)">
                    </td>`;
                } else {
                    tableHTML += `<td class="${editableClass}">${value}</td>`;
                }
            });
            tableHTML += '</tr>';
        });

        tableHTML += '</tbody>';
        this.previewTable.innerHTML = tableHTML;
    }

    toggleEditMode() {
        this.isEditMode = !this.isEditMode;

        if (this.isEditMode) {
            this.editModeBtn.textContent = 'Disable Edit';
            this.saveChangesBtn.style.display = 'inline-flex';
        } else {
            this.editModeBtn.textContent = 'Enable Edit';
            this.saveChangesBtn.style.display = 'none';
        }

        this.renderPreviewTable(this.editableData);
    }

    updateCellValue(rowIndex, header, value) {
        if (this.editableData[rowIndex]) {
            this.editableData[rowIndex][header] = value;
        }
    }

    savePreviewChanges() {
        // The changes are already saved in editableData through updateCellValue
        alert('Changes saved! The export will use your edited data.');
        this.toggleEditMode(); // Disable edit mode after saving
    }

    clearData() {
        this.matches = [];
        this.selectedMatchOdds = null;
        this.selectedMatchId = null;
        this.csvMarkets = [];
        this.matchDropdown.innerHTML = '<option value="">Choose a match...</option>';
        this.matchSelector.style.display = 'none';
        this.results.innerHTML = '<div class="no-data"><p>Click "Fetch Matches" to load current MMA matches</p></div>';
        this.stats.style.display = 'none';
        this.exportBtn.disabled = true;
        this.previewBtn.disabled = true;
        this.fetchOddsBtn.disabled = true;
        this.updateCSVMarketCount();
        this.hideCSVPreview();
        this.editableData = []; // Clear edited data
    }

    updateStats() {
        this.matchCount.textContent = this.matches.length;
        this.updateSelectedMatchStats();
        this.lastUpdated.textContent = new Date().toLocaleString();
        this.stats.style.display = 'flex';
    }

    updateSelectedMatchStats() {
        if (this.selectedMatchId) {
            const selectedMatch = this.matches.find(m => m.id == this.selectedMatchId);
            this.selectedMatch.textContent = selectedMatch ? selectedMatch.name : 'None';
        } else {
            this.selectedMatch.textContent = 'None';
        }
    }

    updateCSVMarketCount() {
        this.csvMarketCount.textContent = this.csvMarkets.length;
        this.exportBtn.disabled = this.csvMarkets.length === 0;
        this.previewBtn.disabled = this.csvMarkets.length === 0;
    }

    refreshOddsDisplay() {
        if (this.selectedMatchOdds && this.selectedMatchId) {
            const selectedMatch = this.matches.find(m => m.id == this.selectedMatchId);
            this.displaySelectedMatchOdds(selectedMatch, this.selectedMatchOdds);
        }
    }

    setLoadingState(loading) {
        this.fetchBtn.disabled = loading;
        this.spinner.classList.toggle('active', loading);
        this.fetchBtn.querySelector('.btn-text').textContent =
            loading ? 'Fetching...' : 'Fetch Matches';
    }

    setOddsLoadingState(loading) {
        this.fetchOddsBtn.disabled = loading;
        this.spinnerOdds.classList.toggle('active', loading);
        this.fetchOddsBtn.querySelector('.btn-text').textContent =
            loading ? 'Loading...' : 'Get Odds';
    }

    showProgress(show) {
        this.progressContainer.style.display = show ? 'block' : 'none';
        if (!show) {
            this.progressFill.style.width = '0%';
        }
    }

    updateProgress(percent, text) {
        this.progressFill.style.width = `${percent}%`;
        this.progressText.textContent = text;
    }

    showError(message) {
        this.results.innerHTML = `<div class="no-data"><p style="color: #f44336;">${message}</p></div>`;
    }

    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    // Helper function to clean league names - returns group name for LEAGUE_NAME
    getCleanLeagueName(betTypeName, match) {
        // Return the group name based on market type - this will be used as LEAGUE_NAME
        const cleanName = betTypeName.toLowerCase();

        if (cleanName.includes('moneyline') || cleanName.includes('winner') || cleanName.includes('to win')) {
            return 'Match Winner';
        } else if (cleanName.includes('winning combinations') || cleanName.includes('winning combination')) {
            return 'Winning Combinations';
        } else if (cleanName.includes('round') || cleanName.includes('distance')) {
            return 'Round & Distance';
        } else if (cleanName.includes('method') || cleanName.includes('finish') || cleanName.includes('decision')) {
            return 'Method of Victory';
        } else if (cleanName.includes('over') || cleanName.includes('under') || cleanName.includes('total')) {
            return 'Totals';
        } else if (cleanName.includes('prop') || cleanName.includes('special')) {
            return 'Props & Specials';
        } else {
            return 'Other Markets';
        }
    }

    // Helper function to clean market names for Domacin column (keeping original logic)
    getCleanMarketNameOld(betTypeName, match) {
        let cleanName = betTypeName;

        // Remove fighter names from league name
        const fighterNames = [match.homeName, match.awayName];
        fighterNames.forEach(fighterName => {
            if (fighterName && fighterName !== 'Unknown') {
                const patterns = [
                    new RegExp(`\\s*by\\s+${fighterName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*`, 'gi'),
                    new RegExp(`\\s*${fighterName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s+to\\s*`, 'gi'),
                    new RegExp(`\\s*${fighterName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*`, 'gi')
                ];
                patterns.forEach(pattern => {
                    cleanName = cleanName.replace(pattern, ' ').trim();
                });
            }
        });

        // Remove redundant words that are already implied in league context
        const redundantPatterns = [
            /\s*-\s*Round\s+\d+/gi,  // Remove "- Round 1", "- Round 2", etc.
            /\s*Winning\s+Round/gi,   // Remove "Winning Round"
            /\s*Round\s+\d+/gi        // Remove standalone "Round 1", etc.
        ];

        redundantPatterns.forEach(pattern => {
            cleanName = cleanName.replace(pattern, '').trim();
        });

        // Clean up extra spaces
        cleanName = cleanName.replace(/\s+/g, ' ').trim();

        // If name becomes too short, use original
        if (cleanName.length < 3) {
            cleanName = betTypeName;
        }

        return cleanName;
    }

    // Helper function to clean market names for Domacin column
    getCleanMarketName(betTypeName, match) {
        let cleanName = betTypeName;

        // Remove fighter names
        const fighterNames = [match.homeName, match.awayName];
        fighterNames.forEach(fighterName => {
            if (fighterName && fighterName !== 'Unknown') {
                const patterns = [
                    new RegExp(`\\s*by\\s+${fighterName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*`, 'gi'),
                    new RegExp(`\\s*${fighterName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s+to\\s*`, 'gi'),
                    new RegExp(`\\s*${fighterName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*`, 'gi')
                ];
                patterns.forEach(pattern => {
                    cleanName = cleanName.replace(pattern, ' ').trim();
                });
            }
        });

        // Clean up extra spaces
        cleanName = cleanName.replace(/\s+/g, ' ').trim();

        if (cleanName.length < 3) {
            cleanName = betTypeName;
        }

        return cleanName;
    }

    // Helper function to check if market is "Win & Over/Under Rounds" type
    isWinAndRoundsMarket(betTypeName) {
        const winAndRoundsPatterns = [
            /win\s*&\s*(over|under)\s*\d+\.?\d*\s*rounds?/gi,
            /to\s*win\s*&\s*(over|under)/gi,
            /win\s*&\s*(go\s*)?(over|under)/gi,
            /win.*&.*(over|under).*rounds?/gi,
            /(over|under).*rounds?.*win/gi,
            /win.*&.*total.*rounds?/gi,
            /total.*rounds?.*win/gi,
            /fighter.*win.*total.*rounds?/gi
        ];

        const result = winAndRoundsPatterns.some(pattern => pattern.test(betTypeName));

        // Debug logging for significant strikes markets
        if (betTypeName.toLowerCase().includes('significant strikes')) {
            console.log('=== isWinAndRoundsMarket DEBUG ===');
            console.log('betTypeName:', betTypeName);
            console.log('isWinAndRoundsMarket result:', result);
            console.log('=== END isWinAndRoundsMarket DEBUG ===');
        }

        return result;
    }
}

// Initialize the app when DOM is loaded
let app;
document.addEventListener('DOMContentLoaded', () => {
    app = new MMAOddsApp();
});
