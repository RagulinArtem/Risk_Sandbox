\# Team plan

Oct 4, 2026 · @Alessandro Rossi

The plan for the day in plain English: what each of the three of us does, when, and what we cut if we run late. The detailed versions are in the PRD and Technical spec tabs.

\#\# The plan in one minute

We are building a crash test for an investor's portfolio: pick a world event, like an oil spike or a rate shock, and see roughly how much the portfolio would lose and which holding hurts most.

\*\*How it works, in five steps\*\*

1\. We watch a real prediction market (a site where people bet real money on whether an event will happen) to see how likely a risk is and how quickly that has changed.  
2\. We turn that into a "what if", for example "tech stocks fall 15%".  
3\. A calculator, not the AI, works out how much the portfolio would lose and which holding causes most of it.  
4\. The AI then explains the result in plain English, using only the calculator's numbers.  
5\. We show all of it live to the judges.

\*\*How we win.\*\* Judges score out of 100: 35 points for a working live demo, 35 for a real business case, 15 for the pitch and 15 for a clever idea. Our clever part is showing how the odds have been moving, not just where they are. Our trust part is that the calculator does the maths, so every number can be checked.

\*\*Who owns what.\*\* Jonathan builds the brain (data, calculator, AI). Artem builds what people see and click. Alessandro owns the story: who it is for, why they would pay, the pitch, the demo script and testing, and takes on the easy technical chores.

\*\*One rule above all.\*\* A smaller demo that works beats a bigger one that breaks. Anything that is not real gets labelled and said out loud.

\#\# Who does what

Two tech roles build the product; the third role owns everything that decides whether it wins.

| Person | Owns | In plain English | Needs from the others |  
| \--- | \--- | \--- | \--- |  
| Jonathan (backend, data, AI) | The brain | Gets the real data, runs the calculator, talks to the AI, makes the demo work offline, saves runs | The agreed data shapes from Artem; the headline scenario from Alessandro |  
| Artem (website and demo) | The screen | Builds everything people see and click, makes it clear on a projector and impossible to break in front of judges | Real data from Jonathan as soon as it exists; the demo script from Alessandro |  
| Alessandro (business, product, strategy) | The story | Who it is for, why they would pay, the demo script, the pitch, the Q\&A answers, testing like a judge, and the easy tech chores | A working build to test from about 16:30; honest answers on what is real |

Team: Jonathan \= Tech mate 1 (the brain), Artem \= Tech mate 2 (the screen), Alessandro \= the story. Who presents and who drives the live demo is a decision for the team; the suggestion is that Alessandro pitches and Tech mate 2 clicks through the demo.

\#\# Where we start from

Artem already has a working prototype (a quick look, not the finished demo). Build on it; do not rebuild it.

\*\*Already there:\*\* the calculator (a preset scenario gives a real loss in % and \$ and a contribution-by-holding chart), six preset scenarios, DEMO and VERIFIED badges, a clearly labelled rule-based explanation as a fallback, and the Portfolio, Risk Radar and Stress Test screens.

\*\*Still missing:\*\*

\- \[ \] The Polymarket signal: every radar item currently shows "Signal: Not connected". This is our main edge, so it is the top priority.  
\- \[ \] A working AI: typing a scenario fails with a raw "402 Payment Required" error because the OpenRouter account is out of credits.  
\- \[ \] The probability chart and the probability-weighted number.  
\- \[ \] A friendly error message instead of raw technical text on screen.

\*\*Decision for the team, early:\*\* which AI provider do we use? The prototype calls OpenRouter, our spec says Amazon Bedrock. Suggestion: ask the organizers about AWS credits first. If credits exist, use Bedrock and keep OpenRouter only as a fallback. If not, top up OpenRouter instead of rewriting the connection.

\*\*Bug list, entry 1:\*\* the AI scenario box fails with the 402 error (owner: Jonathan).

\#\# Alessandro: business, product, strategy

You own the 35% "is it worth building" score and most of the 15% pitch score, plus you are the team's first real user. Here is your list in the order to do it.

\*\*Business and strategy\*\*

\- \[ \] Agree the customer story with the team in the first hour: Anna is the user, advisors are the first paying customer, platforms come later.  
\- \[ \] Spend 10 minutes on Nitrogen's website and write down what it does and does not do, so our answer to "why not Nitrogen?" is accurate.  
\- \[ \] Ask the organizers four things: AWS credits, which Bedrock AI model we can use, what they want handed in (demo, deck, code), and how screens and laptops connect on stage.  
\- \[ \] If time allows, find a source for how many retail investors there are in Hong Kong, and note it. Do not quote numbers you cannot source.  
\- \[ \] Settle the pricing line: advisor seat priced near what comparable tools charge; platforms pay per active user, to be validated.

\*\*Product\*\*

\- \[ \] With Jonathan, choose the headline scenario once real market data exists: pick the market whose odds path is interesting and easy to explain.  
\- \[ \] Write the demo click-script: numbered steps, which button, and the exact words you say at each.  
\- \[ \] Be the plain-English judge: read every explanation aloud; any word you would have to explain gets flagged for rewriting.  
\- \[ \] Fill in the "real versus mocked" table honestly once the tech mates confirm what is live.

\*\*Pitch\*\*

\- \[ \] Write the 3-minute script: problem (Anna), demo, business case, what is next; one line disclosing that the engine was scaffolded before the event.  
\- \[ \] Prepare answers to the seven likely questions (in the PRD tab) and drill them with the team.  
\- \[ \] Rehearse at least five times against a timer after the freeze.

\*\*Easy tech chores you can take (no coding)\*\*

| Chore | Why it matters | Effort |  
| \--- | \--- | \--- |  
| Create the Supabase account and project, paste in the setup text we give you, and pass the keys to Jonathan privately (never in the group chat) | Gives us saved runs; optional, cut at 18:30 | About 15 minutes |  
| Click through the whole demo like a judge and log anything confusing, slow or broken | The "does it work" score is 35% | 15 minutes per pass |  
| Type the five test sentences (listed in the Technical spec) into the scenario box and note which fail | Catches AI parsing problems early | 10 minutes |  
| Run the one-line check script when a tech mate asks, and report any line that fails | A fast way to see whether the system is healthy | 2 minutes |  
| Record the backup video with the screen recorder (Win+Alt+R on Windows, Cmd+Shift+5 on Mac) | Insurance if the live demo breaks | 20 minutes |  
| Proofread every screen for typos and jargon; take screenshots for any slides | Pitch polish | 20 minutes |  
| Keep this doc tidy: tick off tasks and keep the bug list current | Saves everyone's attention | Ongoing |

\#\# Jonathan: backend, data and AI ("the brain")

Your job is everything that happens behind the screen: getting the real data, doing the maths, and getting the AI to explain it. Do these in order. Full detail for each step is in the Technical spec tab.

\- \[ \] \*\*First hour: connect real Polymarket data to the existing radar.\*\* Pull one real market and its probability history. If it works, great. If it fails, tell the team straight away so we switch to a saved, clearly labelled snapshot (plan B) instead of finding out at 18:30.  
\- \[ \] \*\*Agree the data shapes with Artem in the first 30 minutes.\*\* Write down what each backend answer looks like (a few fake sample responses are enough) so the screen can be built at the same time as the brain.  
\- \[ \] \*\*Reuse the existing calculator and add its known-answer test.\*\* Same inputs must always give the same output. Our test case: the reference scenario must produce a \-9.2% hit, which is \$90,800 on the demo portfolio. If that test passes, we can trust every number we show.  
\- \[ \] \*\*Build the sensitivity (beta) table from past prices.\*\* For each holding, how much it tends to move when oil, tech, chips, interest rates or the dollar move. Sanity-check the results (does a chip stock react to chips? does a bond fund react to rates?) and label them DEMO if we cannot fully validate them.  
\- \[ \] \*\*Fix the AI connection (Bedrock or OpenRouter, see the decision above).\*\* Two jobs only: (1) turn a typed sentence into scenario assumptions, (2) explain the calculator's result in plain English using only numbers the calculator produced. Add the fallbacks, so if the AI is down the demo still works.  
\- \[ \] \*\*Save snapshots for offline mode.\*\* Store real data responses so the demo runs with no internet (DEMO\\\_MODE).  
\- \[ \] \*\*Optional: Supabase saving of runs.\*\* Only if everything above is solid. Hard cut at about 18:30.

If you get stuck for more than 20 minutes, say so in the team chat. That is normal, not a failure.

\#\# Artem: website and demo ("the screen")

Your job is everything the judges and users actually see and click. The demo is what gets scored, so a screen that never breaks matters more than extra features.

\- \[ \] \*\*Agree the data shapes with Jonathan in the first 30 minutes.\*\* Use fake sample responses so you are never waiting on the backend.  
\- \[ \] \*\*Extend the existing prototype screens; do not start from scratch.\*\* Add the new pieces on top of what already works, then swap in real data.  
\- \[ \] \*\*Add or finish the main screens, in this order of importance:\*\* (1) the probability chart (the hero of the demo: how the market's odds moved over time), (2) the portfolio panel, (3) the scenario panel (presets plus a box to type your own), (4) the result card (loss in % and \$), (5) the loss-by-holding chart, (6) the AI explanation box, (7) the radar list of live markets, (8) data badges (DEMO / VERIFIED / LIVE / CACHED) on anything that is not fully real.  
\- \[ \] \*\*Make it demo-proof.\*\* Loading states, friendly error messages, a Reset button, big readable text (the room is large), and nothing that needs a refresh to recover.  
\- \[ \] \*\*Connect to the real backend\*\* once Jonathan's endpoints are ready, and check every screen still works with real responses.  
\- \[ \] \*\*One-command start.\*\* A single command (or script) that starts everything, so the demo laptop can be up in under a minute.  
\- \[ \] \*\*Optional: History panel\*\* (replay past runs), only if the Supabase part exists.  
\- \[ \] \*\*Help record the backup video\*\* with Alessandro, using the best take of the full demo.

Around 16:30 both tech mates pair up for end-to-end integration: type a scenario, see the real numbers and the explanation come through the whole chain.

\#\# Hour by hour

Times assume we start building at 11:10 and the event ends at 21:00. If we are behind, shift everything and use the cut order below.

| Time | Alessandro | Jonathan | Artem |  
| \--- | \--- | \--- | \--- |  
| Now (11:10) to \\\~12:10 | Lock the pitch story and the one-sentence idea. Set up Supabase project if we use it. | Prove real Polymarket data works. Agree data shapes. Start the calculator. | Agree data shapes. Website skeleton on fake data. |  
| \\\~12:10 to 13:10 | Draft the 3-minute pitch and the Q\&A answers. | Calculator \+ known-answer test passing (Gate 1: \-9.2% / \$90,800). | Portfolio panel, scenario panel, result card on fake data. |  
| 13:10 to 16:30 | Finish pitch deck/script. Click-through test every new build. Write the 5 test sentences. | Beta table, Bedrock parse \+ explain, fallbacks, snapshots. | Probability chart, loss-by-holding chart, explanation box, badges, radar. |  
| \\\~16:30 | Gate 2: full demo path works end to end once, even if ugly. | Pair with Artem on integration. | Pair with Jonathan on integration. |  
| 16:30 to 18:30 | Rehearse. Log bugs in the shared list. Proofread every on-screen word. | Fix bugs. Optional Supabase saving. | Demo-proofing: errors, reset, big text, start script. |  
| \\\~18:30 | Supabase cut-line: if it is not working, drop it and say nothing about it in the pitch. | Cut or finish Supabase. | Cut or finish History panel. |  
| 18:30 to 19:45 | Record the backup video. Final real-vs-mocked slide. | Final data snapshots. Run the smoke test. | Final polish. One-command start verified on the demo laptop. |  
| \\\~19:45 | Freeze: no new features, no code changes except demo-breaking bugs. | Freeze. | Freeze. |  
| After 19:45 | Full run-throughs with timer, 3 min pitch \+ 2 min Q\&A. | Be ready to answer technical questions. | Drive the demo in rehearsals. |

\#\# Working together

\- \*\*Check-in every \\\~90 minutes, 15 minutes max.\*\* Each person says three things: what is done, what is next, what is stuck.  
\- \*\*One shared bug list.\*\* Anyone can add to it. Whoever owns that area fixes it.  
\- \*\*Stuck for more than 20 minutes? Say so.\*\* Asking early is faster than quietly struggling.  
\- \*\*Scope tie-breaker:\*\* if we disagree on whether to build something, ask "does it help the 3-minute demo?" If not, it waits.  
\- \*\*No new features after \\\~16:30\*\* unless a must-have part is broken.  
\- \*\*Do not push broken code to the main branch.\*\* Test locally first.  
\- \*\*Keep secrets (AWS keys, Supabase keys) out of chat, docs and the repo.\*\* Use the env file only.  
\- \*\*Asking Claude for help:\*\* paste the error or the file, say what you expected and what happened, and say who you are (tech or business) so the answer is pitched right.

\#\# If we fall behind

Cut in this order, top first. Do not debate it in the moment; just follow the list.

1\. Supabase history and saving  
2\. Extra what-if controls  
3\. The live radar  
4\. History replay  
5\. The probability-weighted number (keep the scenario loss itself)  
6\. AI-typed scenarios (fall back to preset scenarios or the rule-based parser)  
7\. Real betas (use the demo table, label it DEMO, and say so in the pitch)

\*\*Never cut:\*\* the real probability path, the working calculator, the plain-English explanation, the honesty labels, the backup video, and rehearsal time.

\*\*If Polymarket fails on the day:\*\* switch to the saved snapshot, label it CACHED, and stop saying "live" in the pitch.

\#\# Plain-English glossary

| Term | Plain meaning |  
| \--- | \--- |  
| Prediction market | A market where people bet on whether events happen; the price is the crowd's probability (Polymarket). |  
| Probability path | How that probability moved over time, not just today's number. |  
| Portfolio | The list of holdings and how much money is in each. |  
| Stress test | Asking "what happens to this portfolio if X happens?" |  
| Scenario | The "X": for example oil spikes or rates jump. |  
| Shock | The size of the market move in a scenario (oil \+30%). |  
| Beta / sensitivity | How much a holding tends to move when something else moves. |  
| Backend | The hidden part that fetches data and does the maths. |  
| Frontend | The website people see and click. |  
| API | The menu of requests the frontend can send the backend. |  
| Bedrock | Amazon's service we use to run the AI. |  
| Supabase | An online database for saving runs (optional). |  
| Snapshot / cache | Saved copy of real data so the demo works offline. |  
| Deterministic | Same input always gives the same output. The calculator is, the AI is not. |  
| Mock | Fake data standing in for real data; we must label it. |  
| Gate | A checkpoint where we confirm something works before moving on. |  
| Freeze | The point after which we stop changing things. |

