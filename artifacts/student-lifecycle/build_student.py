import json,uuid
from pathlib import Path
OUT=Path('artifacts/student-lifecycle');uid=lambda k:str(uuid.uuid5(uuid.NAMESPACE_URL,'flowforge-student-lifecycle/'+k))
nodes=[];edges=[];entities=[];connections=[];scenarios=[];lanes={};answers={};live=[]
stages=[('discover','Discover your programme'),('apply','Application and documents'),('offer','Admissions review and offer'),('funding','Funding and fee planning'),('enrol','Enrolment and registration'),('orient','Orientation and residence'),('learn','Learning and attendance'),('support','Student success and support'),('assess','Assessments and progression'),('career','Careers and placement'),('graduate','Graduation and clearance'),('alumni','Alumni and lifelong learning')]
def n(k,t,c=None,l=0,label=None):
 y=lanes.get(l,0);lanes[l]=y+1;nodes.append(dict(id=uid(k),key=k,type=t,label=label or k.replace('_',' ').title(),config=c or {},position={'x':l*440,'y':y*165}));return k
def e(a,b,h=None,label=None):edges.append(dict(id=uid(a+'>'+b+str(h)),source=uid(a),target=uid(b),sourceHandle=h,label=label))
def chain(*ks):
 for a,b in zip(ks,ks[1:]):e(a,b)
def m(k,text,l=0,**kw):return n(k,'message',dict(text=text,**kw),l)
def q(k,p,typ='text',l=0,value='Demo',**kw):
 answers[k]=value;return n(k,'question',{**dict(prompt=p,answerType=typ,outputVariable=k,answerRequired=True),**kw},l)
def sv(k,values,l=0):return n(k,'set_variable',{'assignments':[{'variableKey':a,'value':b if isinstance(b,str) else '{{parseJson('+json.dumps(json.dumps(b))+')}}','valueType':'string' if isinstance(b,str) else 'array' if isinstance(b,list) else 'boolean' if isinstance(b,bool) else 'number' if isinstance(b,(int,float)) else 'object'} for a,b in values.items()]},l)
def jump(k,to,l=0):return n(k,'skip_to',{'targetNodeKey':to},l)
def choice(k,p,options,l=0,value=None):return q(k,p,'choice',l,value or options[0],choices=options)
def cond(k,left,right,yes,no,l=0,op='eq'):
 n(k,'condition',dict(left=left,operator=op,right=right),l);e(k,yes,'true');e(k,no,'false');return k
def ent(key,fields,rows=None):
 entities.append(dict(id=uid('entity/'+key),key=key,name='Summit '+key.replace('_',' ').title(),description='Fictional student lifecycle showcase. Use institutional access policies before live deployment.',kind='static' if rows else 'dynamic',attributes=[dict(key=a,label=a.replace('_',' ').title(),value_type=t,required=False,is_identifier=a=='code',is_unique=a=='code',sort_order=i) for i,(a,t) in enumerate(fields)],records=rows or []))
programmes=[dict(code='BSC-CS',name='BSc Computing',faculty='Science',annual_fee=52000,minimum_score=28),dict(code='BCOM',name='BCom Business',faculty='Commerce',annual_fee=46000,minimum_score=26),dict(code='BA-DES',name='BA Design',faculty='Humanities',annual_fee=48000,minimum_score=24)]
modules=[dict(code='CS101',title='Programming foundations',credits=16,semester=1),dict(code='MAT101',title='Applied mathematics',credits=16,semester=1),dict(code='COM101',title='Academic communication',credits=8,semester=1)]
ent('programmes',[('code','string'),('name','string'),('faculty','string'),('annual_fee','number'),('minimum_score','number')],programmes)
ent('modules',[('code','string'),('title','string'),('credits','number'),('semester','number')],modules)
for key,fields in [('applications',[('student_ref','string'),('programme','string'),('status','string'),('consent','string')]),('students',[('student_ref','string'),('display_name','string'),('email','string'),('stage','string')]),('registrations',[('student_ref','string'),('modules','array'),('status','string')]),('support_cases',[('student_ref','string'),('topic','string'),('priority','string'),('status','string')]),('appointments',[('student_ref','string'),('service','string'),('date','string')]),('placement_applications',[('student_ref','string'),('employer','string'),('status','string')]),('alumni_preferences',[('student_ref','string'),('interest','string'),('email_opt_in','string')]),('journey_feedback',[('student_ref','string'),('score','number'),('comment','string')])]:ent(key,fields)
ALL={'succeeded':True,'failed':True,'skipped':True,'timedOut':True}
def service(k,typ,c,out,sample,l,connection,purpose):
 # Each external action is individually gated. Failure returns to the hub without claiming success.
 gate=k+'_mode';demo=k+'_demo';check=k+'_confirmed';fail=k+'_unavailable';exit=k+'_result'
 cond(gate,'{{vars.demoMode}}','true',demo,k,l)
 sv(demo,{out:sample} if out else {k+'_simulated':True},l)
 n(k,typ,dict(c,timeoutSeconds=25),l);live.append(k)
 m(check,'The configured service completed this step. Review its returned data before taking further action.',l,runAfter={'succeeded':True,'failed':False,'skipped':False,'timedOut':False},runAfterSkipTo=fail)
 m(fail,'**This action could not be confirmed.** No success is assumed. Inspect Operations and the destination system before retrying; an external action may already have been accepted. Returning to the journey menu.',l,runAfter=ALL)
 jump(k+'_recover','hub',l);chain(k,check,exit);e(k,fail,'failure');chain(fail,k+'_recover');e(demo,exit)
 m(exit,('**SIMULATION** — fictional service output is used while demoMode is true. ' if out else 'Demo mode sends no notification. ')+'This stage is a showcase, not an official institutional decision.',l)
 connections.append(dict(step=k,type=typ,connection=connection,purpose=purpose,configuration=c,expectedDemoResponse=sample))
 return gate,exit
def http(k,path,out,sample,l,method='GET',body=''):
 return service(k,'http',dict(connectionId='',method=method,path=path,body=body,outputVariable=out),out,sample,l,'Student information system HTTP',path)
def email(k,subject,l):return service(k,'email',dict(connectionId='',to='{{vars.studentEmail}}',templateKey='student_email',subject=subject,body='Student reference {{vars.studentRef}}. '+subject),'',None,l,'Institution email SMTP',subject)
def integration(k,purpose,out,sample,l):return service(k,'integration',dict(provider='',integrationId='',action='',fieldValues={'student_ref':'{{vars.studentRef}}'},outputVariable=out),out,sample,l,purpose,purpose)
def record(k,entity,fields,l):return service(k,'entity',dict(entityId=uid('entity/'+entity),operation='create',fieldMap=fields,outputVariable=k+'Record'),k+'Record',{'id':'DEMO-'+k,'status':'simulated'},l,'FlowForge '+entity,'Persist '+entity)
# Entry, explicit demo consent, fictional identity, live identity blueprint.
m('welcome','**Summit University · Every chapter of your student journey**\nFrom your first programme enquiry to alumni mentoring. Explore any stage or follow the guided journey.\nDemo mode uses fictional records and does not call external services. Use synthetic information only.')
choice('consent','May this demonstration use your fictional answers during this session?',['I agree','No thanks'])
cond('consent_route','{{vars.consent}}','I agree','identity_mode','declined')
n('declined','end',{'message':'No problem. No student journey was started.'})
cond('identity_mode','{{vars.demoMode}}','true','demo_identity','student_sign_in')
sv('demo_identity',{'studentRef':'SUM-DEMO-2027-001','studentName':'Alex Student','studentEmail':'alex@example.invalid','identityVerified':False})
n('student_sign_in','sign_in',{'mode':'http','connectionId':'','prompt':'Sign in through your institution’s identity service. Applicants can use their applicant account.','userIdPath':'user.id','tokenPath':'token','profilePath':'user','userIdVariable':'studentRef','tokenVariable':'studentAccessToken','profileVariable':'studentProfile'});live.append('student_sign_in')
sv('live_profile',{'studentName':'{{vars.studentProfile.name}}','studentEmail':'{{vars.studentProfile.email}}','identityVerified':True})
chain('welcome','consent','consent_route');chain('demo_identity','hub');chain('student_sign_in','live_profile','hub')
choice('hub','Choose a chapter. Start with discovery to follow the entire lifecycle.',[label for _,label in stages]+['Finish the journey'])
n('hub_router','switch',{'value':'{{vars.hub}}','cases':[dict(id=k,match=label,label=label) for k,label in stages]+[dict(id='finish',match='Finish the journey')]});e('hub','hub_router');e('hub_router','finish','finish');e('hub_router','hub','default')
for k,label in stages:e('hub_router',k+'_intro',k)
def intro(k,text,l):m(k+'_intro',text,l)
def finish_stage(k,last,l):
 sv(k+'_stage',{'currentStage':k},l);m(k+'_summary','**Chapter complete: '+dict(stages)[k]+'**\nCurrent reference: {{vars.studentRef}}. Completing this demonstration does not change official student standing.',l)
 choice(k+'_next','What would you like to do next?',['Next chapter','Journey menu','Finish'],l,'Finish')
 n(k+'_next_route','switch',{'value':'{{vars.'+k+'_next}}','cases':[dict(id='next',match='Next chapter'),dict(id='menu',match='Journey menu'),dict(id='finish',match='Finish')]},l)
 chain(last,k+'_stage',k+'_summary',k+'_next',k+'_next_route');idx=[x for x,_ in stages].index(k);e(k+'_next_route',stages[idx+1][0]+'_intro' if idx+1<len(stages) else 'finish','next');e(k+'_next_route','hub','menu');e(k+'_next_route','finish','finish');e(k+'_next_route','hub','default')
# 1. discovery
l=1;intro('discover','**Find your direction.** Compare programmes, explore entry requirements and get an indicative fit assessment.',l)
a,b=service('programme_catalog','entity',dict(entityId=uid('entity/programmes'),operation='list',columnMode='selected',selectedColumns=['code','name','annual_fee','minimum_score'],outputVariable='programmes'),'programmes',programmes,l,'FlowForge programmes','Read catalogue')
m('programme_table','{{tabulate(vars.programmes)}}',l);choice('programme_choice','Which programme interests you?',[p['name'] for p in programmes],l)
q('entry_score','Enter a fictional admission score (0–50).','number',l,'30',min=0,max=50)
cond('programme_fit','{{vars.entry_score}}','28','fit_ready','fit_adviser',l,'gte');m('fit_ready','Your demo score meets the sample Computing threshold. Programme-specific requirements and an official admissions review still apply.',l);m('fit_adviser','Explore bridging, foundation and alternative programme routes with an admissions adviser. This is guidance, not a rejection.',l)
chain('discover_intro',a);chain(b,'programme_table','programme_choice','entry_score','programme_fit');finish_stage('discover','fit_ready',l);e('fit_adviser','discover_stage')
# 2. application
l=2;intro('apply','**Build your application.** In demo mode the checklist is simulated. Live applicants upload through a document question and the institutional service must validate documents.',l)
choice('application_type','Choose your application route.',['First-time undergraduate','Transfer student','Postgraduate'],l)
choice('document_check','For this demo, is the document checklist complete?',['Complete','Missing documents'],l)
cond('documents_route','{{vars.document_check}}','Complete','upload_mode','documents_missing',l)
m('documents_missing','Save your draft and gather the required documents. Ask admissions about accepted alternatives; do not submit real IDs in this demo.',l);jump('documents_back','hub',l);chain('documents_missing','documents_back')
cond('upload_mode','{{vars.demoMode}}','true','upload_demo','application_upload',l);sv('upload_demo',{'applicationFiles':['demo-transcript.pdf','demo-school-report.pdf']},l);q('application_upload','Upload the required application documents.','file',l,outputVariable='applicationFiles',sensitive=True);live.append('application_upload')
a,b=http('submit_application','/applications','applicationResult',{'reference':'APP-DEMO-001','status':'received'},l,'POST',json.dumps({'student_ref':'{{vars.studentRef}}','route':'{{vars.application_type}}','programme':'{{vars.programme_choice}}'}))
c,d=record('save_application','applications',{'student_ref':'{{vars.studentRef}}','programme':'{{vars.programme_choice}}','status':'received','consent':'{{vars.consent}}'},l)
x,y=email('application_email','Application acknowledgement — reference {{vars.applicationResult.reference}}',l)
chain('apply_intro','application_type','document_check','documents_route');chain('upload_demo',a);chain('application_upload',a);chain(b,c);chain(d,x);finish_stage('apply',y,l)
# 3. admission decision retrieved, not inferred
l=3;intro('offer','**Track your admissions decision.** Decisions must come from the authorised admissions system. Demo mode lets you explore different sample outcomes.',l)
choice('demo_decision','Select a demonstration admissions outcome.',['Conditional offer','Waitlisted','Further information required'],l)
a,b=http('admission_status','/applications/{{vars.studentRef}}/decision','admissionDecision',{'status':'{{vars.demo_decision}}','offer_ref':'OFFER-DEMO-001'},l)
next(x for x in nodes if x['key']=='admission_status_demo')['config']['assignments'][0]['value']='{{parseJson(concat(' + repr('{"status":"') + ', vars.demo_decision, ' + repr('","offer_ref":"OFFER-DEMO-001"}') + '))}}'
n('offer_route','switch',{'value':'{{vars.admissionDecision.status}}','cases':[dict(id='offer',match='Conditional offer'),dict(id='wait',match='Waitlisted')]},l)
m('offer_wait','Your sample application is waitlisted. Request an adviser review and track deadlines; no place has been reserved.',l);m('offer_info','Admissions needs more information. Review the official checklist before resubmitting.',l)
choice('accept_offer','Would you like to accept the sample conditional offer?',['Accept','Discuss with adviser'],l)
a2,b2=http('accept_offer_api','/offers/{{vars.admissionDecision.offer_ref}}/accept','offerAcceptance',{'status':'accepted_conditionally'},l,'POST',json.dumps({'student_ref':'{{vars.studentRef}}'}))
cond('offer_accept_route','{{vars.accept_offer}}','Accept',a2,'offer_info',l)
chain('offer_intro','demo_decision',a);chain(b,'offer_route');e('offer_route','accept_offer','offer');e('offer_route','offer_wait','wait');e('offer_route','offer_info','default');chain('accept_offer','offer_accept_route');finish_stage('offer',b2,l);e('offer_wait','offer_stage');e('offer_info','offer_stage')
# 4. fees, scholarship estimate, hosted checkout
l=4;intro('funding','**Plan your funding.** Figures are illustrative. Scholarship decisions, invoices and payment status come from authorised services.',l)
q('fee_estimate','Sample tuition amount in ZAR','currency',l,'52000',min=0);q('funding_award','Sample confirmed funding amount in ZAR','currency',l,'12000',min=0)
n('net_fee','operation',dict(operation='subtract',left='{{vars.fee_estimate}}',right='{{vars.funding_award}}',outputVariable='balanceEstimate'),l)
m('fee_summary','Indicative balance: R{{vars.balanceEstimate}}. An overpayment/credit needs finance review. Never use this estimate as a verified account balance.',l)
choice('funding_action','Choose a funding route.',['View funding options','Hosted payment demonstration','Request payment plan'],l)
n('funding_route','switch',dict(value='{{vars.funding_action}}',cases=[dict(id='pay',match='Hosted payment demonstration'),dict(id='plan',match='Request payment plan')]),l)
a,b=http('funding_lookup','/funding/opportunities','fundingOptions',[{'name':'Merit award','status':'Applications open'},{'name':'Financial assistance','status':'Assessment required'}],l);m('funding_table','{{tabulate(vars.fundingOptions)}}',l)
cond('payment_mode','{{vars.demoMode}}','true','payment_demo','tuition_payment',l);m('payment_demo','**SIMULATED CHECKOUT. No money was collected.** Live mode uses a hosted provider and server-confirmed payment status.',l);q('tuition_payment','Pay the institutional invoice through the configured hosted provider.','payment',l,paymentConnectionId='',paymentAmount='{{vars.balanceEstimate}}',currencyCode='ZAR',paymentBuyerEmail='{{vars.studentEmail}}',paymentItemName='Student tuition invoice');live.append('tuition_payment')
c,d=http('payment_plan','/finance/payment-plan-requests','paymentPlan',{'reference':'PLAN-DEMO-001','status':'pending_review'},l,'POST',json.dumps({'student_ref':'{{vars.studentRef}}','estimated_balance':'{{vars.balanceEstimate}}'}))
chain('funding_intro','fee_estimate','funding_award','net_fee','fee_summary','funding_action','funding_route');e('funding_route',a,'default');e('funding_route','payment_mode','pay');e('funding_route',c,'plan');chain(b,'funding_table');finish_stage('funding','funding_table',l);e('payment_demo','funding_stage');e('tuition_payment','funding_stage');e(d,'funding_stage')
# 5. registration and LMS provisioning
l=5;intro('enrol','**Register for your learning journey.** Live registration requires an accepted offer, completed checks and server-validated prerequisites.',l)
a,b=http('registration_clearance','/students/{{vars.studentRef}}/registration-clearance','clearance',{'eligible':True},l)
cond('registration_check','{{vars.clearance.eligible}}','true','registration_modules','registration_hold',l)
m('registration_hold','Registration is on hold. Contact the registrar to resolve outstanding requirements. No enrolment is confirmed.',l);jump('registration_return','hub',l);chain('registration_hold','registration_return')
sv('registration_modules',{'moduleRows':modules},l);m('module_table','{{tabulate(vars.moduleRows)}}',l);choice('registration_confirm','Confirm this fictional semester module selection?',['Confirm','Review later'],l)
c,d=http('register_modules','/registrations','registration',{'reference':'REG-DEMO-001','status':'registered'},l,'POST',json.dumps({'student_ref':'{{vars.studentRef}}','module_codes':['CS101','MAT101','COM101']}))
cond('registration_confirm_route','{{vars.registration_confirm}}','Confirm',c,'registration_hold',l)
x,y=integration('lms_provision','LMS / Moodle or Canvas enrolment','lmsAccess',{'course_space':'DEMO-CS101','status':'provisioned'},l)
chain('enrol_intro',a);chain(b,'registration_check');chain('registration_modules','module_table','registration_confirm','registration_confirm_route');chain(d,x);finish_stage('enrol',y,l)
# 6. campus readiness
l=6;intro('orient','**Feel at home.** Plan orientation, residence and accessibility support without asking for medical details.',l)
choice('campus_service','What should we arrange?',['Orientation session','Residence enquiry','Accessibility appointment'],l)
q('campus_date','Choose a preferred appointment date.','date',l,'2027-02-01')
a,b=integration('campus_calendar','Calendar appointment / Microsoft 365 or Google Calendar','campusAppointment',{'reference':'APT-DEMO-001','status':'requested'},l)
c,d=record('save_appointment','appointments',{'student_ref':'{{vars.studentRef}}','service':'{{vars.campus_service}}','date':'{{vars.campus_date}}'},l)
x,y=email('orientation_email','Your campus service request has been received',l)
chain('orient_intro','campus_service','campus_date',a);chain(b,c);chain(d,x);finish_stage('orient',y,l)
# 7. learning: table, checklist loop and early support
l=7;intro('learn','**Stay on track.** View a fictional timetable and learning checklist. Live attendance information must be limited to the authenticated student.',l)
a,b=http('learning_dashboard','/students/{{vars.studentRef}}/learning','learningRows',[{'module':'CS101','next_class':'Monday 09:00','attendance':92},{'module':'MAT101','next_class':'Tuesday 10:00','attendance':68}],l)
m('learning_table','{{tabulate(vars.learningRows)}}',l)
sv('learning_tasks',{'learningTasks':['Open your LMS course spaces','Review assessment dates','Book tutor office hours']},l)
n('learning_loop','loop',dict(collection='{{vars.learningTasks}}',itemVariable='learningTask',indexVariable='taskIndex'),l);m('learning_task','Checklist item: {{vars.learningTask}}',l);e('learning_loop','learning_task','body')
choice('learning_support','Would you like learning support?',['Book a tutor','I am on track'],l)
x,y=integration('tutor_booking','Student success / tutor appointment','tutorRequest',{'status':'requested','reference':'TUTOR-DEMO-001'},l)
cond('tutor_route','{{vars.learning_support}}','Book a tutor',x,'learning_complete',l);m('learning_complete','Your support preferences are recorded for this demonstration.',l)
chain('learn_intro',a);chain(b,'learning_table','learning_tasks','learning_loop');e('learning_loop','learning_support',label='Then');chain('learning_support','tutor_route');e(y,'learning_complete');finish_stage('learn','learning_complete',l)
# 8. case prioritisation, adviser handoff and native ticket
l=8;intro('support','**A person when you need one.** Request academic, financial or accessibility assistance. This chatbot is not an emergency service; use local emergency services for immediate danger.',l)
choice('support_topic','What type of support do you need?',['Academic advising','Financial support','Accessibility support','General student service'],l)
choice('support_urgency','How urgent is this request?',['Routine','Time-sensitive'],l)
cond('priority_route','{{vars.support_urgency}}','Time-sensitive','priority_high','priority_normal',l);sv('priority_high',{'casePriority':'high'},l);sv('priority_normal',{'casePriority':'normal'},l)
a,b=record('support_record','support_cases',{'student_ref':'{{vars.studentRef}}','topic':'{{vars.support_topic}}','priority':'{{vars.casePriority}}','status':'open'},l)
c,d=integration('support_ticket','Jira Service Management / create student case','supportTicket',{'key':'STUDENT-DEMO-001','status':'open'},l)
cond('support_handoff_mode','{{vars.demoMode}}','true','handoff_demo','adviser_handoff',l);m('handoff_demo','**Simulated handoff.** An adviser would receive the student reference, selected topic, priority and conversation context. No agent has been contacted.',l);n('adviser_handoff','handoff',dict(queueId='',message='Connecting you with a student adviser.',priority='{{vars.casePriority}}'),l);live.append('adviser_handoff')
chain('support_intro','support_topic','support_urgency','priority_route');e('priority_high',a);e('priority_normal',a);chain(b,c);chain(d,'support_handoff_mode');finish_stage('support','handoff_demo',l);e('adviser_handoff','support_stage')
# 9. assessment, analytics and appeal
l=9;intro('assess','**Review your academic progress.** Only the official student system can confirm marks and progression decisions.',l)
a,b=http('academic_results','/students/{{vars.studentRef}}/results','results',[{'module':'CS101','mark':74,'credits':16},{'module':'MAT101','mark':61,'credits':16},{'module':'COM101','mark':79,'credits':8}],l)
m('results_table','{{tabulate(vars.results)}}',l);choice('assessment_action','What would you like to do?',['View progression guidance','Request a mark review'],l)
c,d=http('assessment_appeal','/assessment/review-requests','appeal',{'reference':'APPEAL-DEMO-001','status':'received'},l,'POST',json.dumps({'student_ref':'{{vars.studentRef}}','reason':'Student requested an academic review'}))
cond('assessment_route','{{vars.assessment_action}}','Request a mark review',c,'progression_guidance',l)
m('progression_guidance','Review programme-specific prerequisites and your official progression notice. A submitted review is not a changed result.',l)
chain('assess_intro',a);chain(b,'results_table','assessment_action','assessment_route');e(d,'progression_guidance');finish_stage('assess','progression_guidance',l)
# 10. career placement
l=10;intro('career','**Turn learning into opportunity.** Explore fictional placements, book careers support and submit a placement expression of interest.',l)
a,b=http('career_opportunities','/careers/opportunities','opportunities',[{'code':'INT-001','role':'Software intern','employer':'Example Labs'},{'code':'INT-002','role':'Business analyst intern','employer':'Demo Consulting'}],l)
m('career_table','{{tabulate(vars.opportunities)}}',l);choice('career_choice','Choose a placement to explore.',['INT-001','INT-002'],l)
c,d=integration('career_crm','Careers CRM / placement expression of interest','placement',{'reference':'PLACE-DEMO-001','status':'submitted_for_review'},l)
x,y=email('career_email','Your placement interest has been received — no placement is guaranteed',l)
chain('career_intro',a);chain(b,'career_table','career_choice',c);chain(d,x);finish_stage('career',y,l)
# 11. graduation clearance independent checks, no fake official certificate
l=11;intro('graduate','**Celebrate the milestone.** Graduation eligibility requires academic, library and finance clearance from institutional systems.',l)
a,b=http('graduation_clearance','/students/{{vars.studentRef}}/graduation-clearance','graduationClearance',{'eligible':True,'academic':'cleared','library':'cleared','finance':'cleared'},l)
cond('graduation_route','{{vars.graduationClearance.eligible}}','true','graduation_attendance','graduation_hold',l)
m('graduation_hold','One or more graduation checks remain outstanding. Contact the registrar. No qualification or certificate has been issued.',l);jump('graduation_hold_return','hub',l);chain('graduation_hold','graduation_hold_return')
choice('graduation_attendance','How would you attend the sample graduation?',['In person','In absentia'],l)
c,d=http('graduation_rsvp','/graduation/rsvp','graduationRsvp',{'reference':'GRAD-DEMO-001','status':'received'},l,'POST',json.dumps({'student_ref':'{{vars.studentRef}}','attendance':'{{vars.graduation_attendance}}'}))
m('graduation_document','{{templates.student_document.file}}',l)
chain('graduate_intro',a);chain(b,'graduation_route');chain('graduation_attendance',c);chain(d,'graduation_document');finish_stage('graduate','graduation_document',l)
# 12. alumni consent and CRM
l=12;intro('alumni','**Your connection continues.** Join mentoring, explore continuing education, attend reunions and control communication preferences.',l)
choice('alumni_interest','How would you like to stay involved?',['Mentor a student','Continuing education','Alumni events','Update my details'],l)
choice('alumni_opt_in','Would you like optional alumni email updates?',['Yes, opt me in','No, service messages only'],l)
a,b=record('alumni_preferences','alumni_preferences',{'student_ref':'{{vars.studentRef}}','interest':'{{vars.alumni_interest}}','email_opt_in':'{{vars.alumni_opt_in}}'},l)
c,d=integration('alumni_crm','Alumni CRM / upsert contact preferences','alumniProfile',{'reference':'ALUM-DEMO-001','status':'preferences_saved'},l)
x,y=email('alumni_welcome','Your alumni communication preferences',l)
m('alumni_service_only','Optional marketing is off. You can revisit your preferences; institutional service messages follow the institution’s policy.',l)
cond('alumni_mail_route','{{vars.alumni_opt_in}}','Yes, opt me in',x,'alumni_service_only',l)
chain('alumni_intro','alumni_interest','alumni_opt_in',a);chain(b,c);chain(d,'alumni_mail_route');finish_stage('alumni',y,l);e('alumni_service_only','alumni_stage')
# Finish and feedback
m('finish','**Thank you for exploring Summit.** Your last demonstration chapter: {{vars.currentStage}}. Downloadable materials are sample documents, not qualifications or official records.')
q('journey_score','How useful was this student journey?','nps',0,'9',min=0,max=10)
q('journey_comment','What should we improve?','long_text',0,'Clearer programme guidance',maxLength=1000)
a,b=record('journey_feedback','journey_feedback',{'student_ref':'{{vars.studentRef}}','score':'{{vars.journey_score}}','comment':'{{vars.journey_comment}}'},0)
n('end','end',{'message':'Thank you, {{vars.studentName}}. Explore the designer, test scenarios, Operations and Analytics to see how this journey works.'});chain('finish','journey_score','journey_comment',a);e(b,'end')
globals=[dict(key=k,value_type=t,default_value=v,description=d) for k,t,v,d in [('demoMode','boolean',True,'Keep true for the bundled showcase; configure every live dependency before switching off.'),('studentRef','string','SUM-DEMO-2027-001','Fictional identity. Live sign-in overwrites this value.'),('studentName','string','Alex Student','Fictional name.'),('studentEmail','string','alex@example.invalid','Synthetic address; live sign-in must supply a verified address.'),('programme_choice','string','BSc Computing','Default for direct chapter exploration.'),('currentStage','string','welcome','Latest demonstrated chapter, not official academic standing.'),('demo_decision','string','Conditional offer','Illustrative admissions outcome.')]]
base=[{'step':'consent','value':'I agree'}];ending=[{'step':'journey_score','value':'9'},{'step':'journey_comment','value':'Clearer programme guidance'}]
chapter_answers={'discover':['programme_choice','entry_score'],'apply':['application_type','document_check'],'offer':['demo_decision','accept_offer'],'funding':['fee_estimate','funding_award','funding_action'],'enrol':['registration_confirm'],'orient':['campus_service','campus_date'],'learn':['learning_support'],'support':['support_topic','support_urgency'],'assess':['assessment_action'],'career':['career_choice'],'graduate':['graduation_attendance'],'alumni':['alumni_interest','alumni_opt_in']}
for k,label in stages:
 scripted=base+[{'step':'hub','value':label}]+[{'step':x,'value':answers[x]} for x in chapter_answers[k]]+[{'step':k+'_next','value':'Finish'}]+ending
 scenarios.append(dict(name='Student lifecycle — '+label,globals={'demoMode':True},expected={'answers':scripted,'variables':['studentRef'],'stepKeys':[k+'_summary','end'],'values':{'currentStage':k}}))
scripted=base+[{'step':'hub','value':stages[0][1]}]
for i,(k,label) in enumerate(stages):
 scripted += [{'step':x,'value':answers[x]} for x in chapter_answers[k]]+[{'step':k+'_next','value':'Next chapter' if i<len(stages)-1 else 'Finish'}]
scenarios.append(dict(name='Complete guided lifecycle',globals={'demoMode':True},expected={'answers':scripted+ending,'stepKeys':[k+'_summary' for k,_ in stages]+['end'],'values':{'currentStage':'alumni'}}))
scenarios.append(dict(name='Privacy — decline consent',globals={'demoMode':True},expected={'answers':[{'step':'consent','value':'No thanks'}],'stepKeys':['declined']}))
pack=dict(kind='flowforge.chatbotFlow',version=1,exportedAt='2026-09-27T00:00:00.000Z',chatbot=dict(id=uid('bot'),name='Summit Student Lifecycle',description='Fictional end-to-end student lifecycle: discovery, admission, funding, enrolment, student success, graduation and alumni. Demo mode enabled; live services require configuration.'),flow=dict(id=uid('flow'),name='Admission to alumni',version=1),globals=globals,nodes=nodes,edges=edges,entities=[{'id':x['id'],'key':x['key']} for x in entities],entityDefs=entities,testScenarios=scenarios,templates=[])
OUT.mkdir(exist_ok=True);(OUT/'student-lifecycle.raw.json').write_text(json.dumps(pack,indent=2),encoding='utf-8');(OUT/'connections.json').write_text(json.dumps({'kind':'flowforge.configuration-guide','note':'Setup reference, not an import file. Create and install connections in FlowForge, then map their generated IDs. Never store credentials in this file.','liveSteps':live,'connections':connections},indent=2),encoding='utf-8')
print(len(nodes),'nodes;',len(edges),'edges;',len(entities),'entities;',len(scenarios),'scenarios')
