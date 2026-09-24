import json, uuid
from pathlib import Path
out=Path('artifacts/flowforge-atlas')
uid=lambda key:str(uuid.uuid5(uuid.NAMESPACE_URL,'flowforge-atlas/'+key))
nodes=[];edges=[];globals=[];entities=[];templates=[];lanes={}
def node(key,typ,label,config={},lane=0):
 y=lanes.get(lane,0);lanes[lane]=y+1
 nodes.append(dict(id=uid(key),key=key,type=typ,label=label,config=config,position=dict(x=lane*420,y=y*180)))
 return key
def edge(a,b,h=None,label=None):edges.append(dict(id=uid(a+'>'+b+str(h)),source=uid(a),target=uid(b),sourceHandle=h,label=label))
def chain(*keys):
 for a,b in zip(keys,keys[1:]):edge(a,b)
def msg(k,text,l=0):return node(k,'message',k.replace('_',' ').title(),{'text':text,'enterAnimation':'rise'},l)
def q(k,text,answer='text',l=0,**cfg):return node(k,'question',k.replace('_',' ').title(),dict(prompt=text,answerType=answer,outputVariable=k,answerRequired=True,**cfg),l)
def setv(k,values,l=0):return node(k,'set_variable',k.replace('_',' ').title(),{'assignments':[dict(variableKey=a,value=b if isinstance(b,str) else json.dumps(b),valueType=t) for a,b,t in values]},l)
def back(k,l):return node(k,'skip_to','Return to Atlas hub',{'targetNodeKey':'hub'},l)
def gate(k,live,demo,l):
 node(k,'condition','Demo mode / live configuration',dict(left='{{vars.demoMode}}',operator='eq',right='true'),l);edge(k,demo,'true');edge(k,live,'false');return k
def entity(k,op,e,l=0,**cfg):return node(k,'entity',k.replace('_',' ').title(),dict(entityId=uid('entity/'+e),operation=op,**cfg),l)
def schema(key,cols,rows=[],dynamic=False):
 entities.append(dict(id=uid('entity/'+key),key=key,name='Atlas '+key.replace('atlas_','').replace('_',' ').title(),description='Fictional Atlas showcase data.',kind='dynamic' if dynamic else 'static',attributes=[dict(key=k,label=k.replace('_',' ').title(),value_type=t,sort_order=i,required=False,is_identifier=k=='code',is_unique=k=='code') for i,(k,t) in enumerate(cols)],records=rows))
def g(k,t,v,d):globals.append(dict(key=k,value_type=t,default_value=v,description=d))
g('demoMode','boolean',True,'Keep true until all live connections, queues and templates have been configured.')
g('brand','string','Atlas Experience Group','Fictional showcase brand')
g('visitor','object',{'name':'Explorer','email':'explorer@example.invalid'},'Fictional preview profile')
g('excel','object',{'records':[{'region':'Gauteng','visits':124,'revenue':62000},{'region':'Western Cape','visits':98,'revenue':58800},{'region':'KwaZulu-Natal','visits':76,'revenue':38000}]},'Sample Excel-shaped records; replace with imported records.')
g('serviceHighlights','array',['24/7 self-service','Personalised recommendations','Live agent escalation'],'Loop demonstration')
g('currency','string','ZAR','Display currency')
schema('atlas_products',[('code','string'),('name','string'),('category','string'),('price','number'),('stock','number'),('supplier_code','string')],[dict(code='P'+str(i),name=n,category=c,price=p,stock=20+i,supplier_code='S'+str(i%3+1)) for i,(n,c,p) in enumerate([('City Explorer','Tours',450),('Mountain Escape','Tours',890),('Coastal Weekend','Stays',2200),('Urban Retreat','Stays',1400),('Discovery Pass','Passes',650),('Family Adventure','Tours',1800),('Spa Recharge','Wellness',750),('Food Trail','Tours',520),('Museum Circuit','Passes',280),('Premium Transfer','Transport',380),('Sunset Cruise','Tours',680),('Garden Walk','Tours',190)],1)])
schema('atlas_suppliers',[('code','string'),('name','string'),('city','string')],[dict(code='S1',name='Atlas North',city='Johannesburg'),dict(code='S2',name='Atlas Coast',city='Cape Town'),dict(code='S3',name='Atlas East',city='Durban')])
schema('atlas_faq',[('code','string'),('question','string'),('answer','string')],[dict(code='F1',question='Can I change a booking?',answer='Demo policy: changes up to 24 hours before departure.'),dict(code='F2',question='Are payments real?',answer='Demo mode never collects money. Live checkout requires a configured payment connection.')])
for key,cols in [('atlas_leads',[('name','string'),('email','string'),('interest','string')]),('atlas_bookings',[('customer','string'),('service','string'),('date','string'),('status','string')]),('atlas_tickets',[('subject','string'),('details','string'),('priority','string'),('status','string')]),('atlas_feedback',[('rating','number'),('comment','string')]),('atlas_scratch',[('note','string')])]:schema(key,cols,dynamic=True)
msg('welcome','**Welcome to Atlas. One conversation. An entire business.**\nExplore experiences, build an order, book a visit, resolve a problem, or open the technology playground.\nThis is a fictional demo. Live services stay off while demoMode is true.')
q('intro_profile','What should I call you? Use fictional details for this demo.','name',minLength=2,maxLength=60)
setv('remember_name',[('displayName','{{intro_profile}}','string')])
# reference actual vars prefix
nodes[-1]['config']['assignments'][0]['value']='{{vars.intro_profile}}'
msg('personal_welcome','Welcome, **{{vars.displayName}}**. Pick a journey; each one returns here so you can explore at your own pace.')
journeys=[('Commerce & checkout','shop_intro'),('Bookings & documents','booking_intro'),('Customer support','support_intro'),('Data & Excel tables','data_intro'),('Automation & integrations','automation_intro'),('Response playground','playground'),('Rich content gallery','gallery_intro'),('Identity & permissions','identity_intro'),('Feedback & analytics','feedback_intro'),('Finish the tour','finish')]
q('hub','What would you like to explore?','choice',choices=[a for a,b in journeys]);node('hub_route','switch','Journey router',{'value':'{{vars.hub}}','cases':[dict(id='route_'+str(i),match=a,label=a) for i,(a,b) in enumerate(journeys)]});chain('welcome','intro_profile','remember_name','personal_welcome','hub','hub_route')
for i,(a,b) in enumerate(journeys):edge('hub_route',b,'route_'+str(i))
edge('hub_route','hub','default')
# Commerce
l=1;msg('shop_intro','**Your next experience starts here.** Browse the catalog, build a cart, and see a clearly labelled checkout simulation.',l)
entity('catalog','list','atlas_products',l,outputVariable='products',columnMode='selected',selectedColumns=['code','name','category','price','stock'])
msg('catalog_table','Here is our live entity catalog. Maximise the table to compare all 12 experiences.\ntabulate({{vars.products}})',l)
q('cart','Add experiences to your basket.','shop',l,shopTemplateKey='atlas_cart')
msg('cart_summary','**Your basket**\n{{vars.cart}}',l)
gate('payment_mode','live_payment','demo_payment',l)
msg('demo_payment','**Demo checkout**\nNo charge is made. This previews the confirmation journey; it is not a verified payment.',l)
setv('mock_payment',[('paymentResult',{'status':'simulated','provider':'demo'},'object')],l)
q('live_payment','Complete secure checkout with your configured provider.','payment',l,paymentTemplateKey='atlas_payment',outputVariable='paymentResult') if False else node('live_payment','question','LIVE: configure payment template',{'prompt':'Complete secure checkout with your configured provider.','answerType':'payment','outputVariable':'paymentResult','paymentTemplateKey':'atlas_payment'},l)
msg('order_receipt','**Order summary**\n{{templates.atlas_receipt.text}}\nPayment result: {{vars.paymentResult}}',l)
back('shop_back',l);chain('shop_intro','catalog','catalog_table','cart','cart_summary','payment_mode');chain('demo_payment','mock_payment','order_receipt','shop_back');edge('live_payment','order_receipt')
# Booking
l=2;msg('booking_intro','**Build your perfect visit.** Choose a service, capture contact details, and generate a personalised document.',l)
q('booking_service','Choose an experience.','autocomplete',l,choices=['City Explorer','Mountain Escape','Sunset Cruise'])
q('booking_date','Choose a date.','date',l)
q('booking_time','Choose a time.','time',l)
q('booking_people','How many guests?','stepper',l,min=1,max=12,step=1)
q('booking_contact','Your fictional contact details','form',l,formFields=[dict(key='name',label='Name',type='name',required=True),dict(key='email',label='Email',type='email',required=True)])
q('booking_consent','Review the demo booking policy: no reservation or charge is made by this walkthrough.','confirm',l,confirmLabel='I understand this is a demo')
entity('save_booking','create','atlas_bookings',l,outputVariable='booking',fieldMap={'customer':'{{vars.booking_contact.name}}','service':'{{vars.booking_service}}','date':'{{vars.booking_date}}','status':'demo'})
msg('booking_document','**Your itinerary**\n{{templates.atlas_document.file}}',l);nodes[-1]['config']['templateBindings']={'atlas_document':{'name':'{{vars.booking_contact.name}}','service':'{{vars.booking_service}}'}}
msg('booking_calendar','{{templates.atlas_calendar.text}}\nBooking reference: {{vars.booking.id}}',l);back('booking_back',l)
chain('booking_intro','booking_service','booking_date','booking_time','booking_people','booking_contact','booking_consent','save_booking','booking_document','booking_calendar','booking_back')
# Support
l=3;msg('support_intro','**Let us get you unstuck.** Find an answer or create a demo support request.',l)
entity('faq_query','list','atlas_faq',l,outputVariable='faqRows',columnMode='selected',selectedColumns=['question','answer']);msg('faq_table','tabulate({{vars.faqRows}})',l)
q('issue_subject','What do you need help with?','text',l,minLength=4,maxLength=100);q('issue_details','Tell us what happened.','long_text',l,minLength=10,maxLength=1500)
q('issue_urgency','How urgent is this?','choice',l,choices=['Normal','Urgent'])
node('urgent_check','condition','Priority triage',dict(left='{{vars.issue_urgency}}',operator='eq',right='Urgent'),l)
setv('priority_high',[('priority','high','string')],l);setv('priority_normal',[('priority','normal','string')],l)
entity('create_ticket','create','atlas_tickets',l,outputVariable='ticket',fieldMap={'subject':'{{vars.issue_subject}}','details':'{{vars.issue_details}}','priority':'{{vars.priority}}','status':'open'})
msg('ticket_receipt','Your demo ticket **{{vars.ticket.id}}** is recorded with **{{vars.priority}}** priority.\n{{templates.atlas_ticket.text}}',l)
gate('agent_mode','live_handoff','demo_handoff',l);msg('demo_handoff','**Agent handoff preview**\nThe live version queues this conversation for an agent, with its history and captured context. Operations intelligence can suggest an available agent. No agent has been contacted in demo mode.',l)
node('live_handoff','handoff','LIVE: choose support queue',{'message':'Connecting you with the Atlas support team.','queueId':''},l);back('support_back',l)
chain('support_intro','faq_query','faq_table','issue_subject','issue_details','issue_urgency','urgent_check');edge('urgent_check','priority_high','true');edge('urgent_check','priority_normal','false');edge('priority_high','create_ticket');edge('priority_normal','create_ticket');chain('create_ticket','ticket_receipt','agent_mode');edge('demo_handoff','support_back');edge('live_handoff','support_back')
# data
l=4;msg('data_intro','**From records to insight.** Query entities, join suppliers, inspect Excel-shaped data, and exercise create/update/delete on a disposable demo record.',l)
entity('joined_products','list','atlas_products',l,outputVariable='joinedProducts',joins=[dict(entityId=uid('entity/atlas_suppliers'),alias='supplier',localColumn='supplier_code',foreignColumn='code',kind='left')],columnMode='selected',selectedColumns=['name','price','supplier.name','supplier.city'])
node('supplier_loop','loop','Loop through joined products',dict(collection='{{vars.joinedProducts}}',itemVariable='product',indexVariable='productIndex'),l)
msg('supplier_row','{{vars.product.name}} - {{vars.product.supplier.name}}, {{vars.product.supplier.city}} - R{{vars.product.price}}',l)
msg('excel_table','**Excel records**\nThis sample has the same shape as imported worksheet records.\ntabulate({{vars.excel.records}})',l)
entity('scratch_create','create','atlas_scratch',l,outputVariable='scratch',fieldMap={'note':'Created during Atlas demo'})
entity('scratch_update','update','atlas_scratch',l,recordId='{{vars.scratch.id}}',outputVariable='scratchUpdated',fieldMap={'note':'Updated during Atlas demo'})
entity('scratch_get','get','atlas_scratch',l,recordId='{{vars.scratch.id}}',outputVariable='scratchRead')
msg('scratch_view','**Read after update**\ntabulate({{vars.scratchRead}})',l)
entity('scratch_delete','delete','atlas_scratch',l,recordId='{{vars.scratch.id}}',outputVariable='scratchDeleted');msg('scratch_done','The disposable record created in this journey has been deleted.\n{{vars.scratchDeleted}}',l);back('data_back',l)
chain('data_intro','joined_products','supplier_loop');edge('supplier_loop','supplier_row','body');edge('supplier_loop','excel_table',None,'Then');chain('excel_table','scratch_create','scratch_update','scratch_get','scratch_view','scratch_delete','scratch_done','data_back')
# automation
l=5;msg('automation_intro','**Connect the business.** This lane has HTTP, SQL, email, native integrations, events, error recovery, and a cross-chatbot transfer. All live calls are bypassed in demo mode.',l)
setv('demo_automation',[('apiResult',{'status':200,'data':{'tracking':'ATLAS-DEMO-001','state':'ready'}},'object'),('integrationResult',{'key':'ATLAS-123','status':'simulated'},'object')],l)
node('quote_total','operation','Calculate a quote',dict(operation='multiply',left='450',right='3',outputVariable='quoteTotal'),l)
msg('automation_summary','Computed quote: **R{{vars.quoteTotal}}**\nTracking: {{vars.apiResult.data.tracking}}\nIssue: {{vars.integrationResult.key}}',l)
q('live_action','Choose the connector blueprint to explore.','choice',l,choices=['HTTP tracking','SQL lookup','Email quote','Native integration','Specialist chatbot'])
node('live_action_route','switch','Connector router',dict(value='{{vars.live_action}}',cases=[dict(id=k,match=v) for k,v in [('http','HTTP tracking'),('sql','SQL lookup'),('email','Email quote'),('integration','Native integration'),('transfer','Specialist chatbot')]]),l)
for typ,choice in [('http','http'),('database','sql'),('email','email'),('integration','integration'),('transfer','transfer')]:
 key='live_'+typ;demo='preview_'+typ
 configs={'http':dict(connectionId='',method='GET',path='/tracking/{{vars.apiResult.data.tracking}}',outputVariable='trackingLive'), 'database':dict(connectionId='',operation='query',sql='SELECT code, name, price FROM products WHERE code = :product_code',paramValues={'product_code':'P1'},outputVariable='sqlRows'), 'email':dict(connectionId='',to='{{vars.visitor.email}}',templateKey='atlas_email',subject='Your Atlas quote',body='Demo quote: R{{vars.quoteTotal}}'), 'integration':dict(provider='',integrationId='',action='',fieldValues={},outputVariable='nativeResult'), 'transfer':dict(targetChatbotId='',message='Opening the specialist concierge.',passAllVariables=False,variableMappings=[dict(source='{{vars.displayName}}',target='customerName')])}
 node(key,typ,'LIVE: configure '+typ,configs[typ],l)
 msg(demo,{'http':'HTTP tracking uses a configured GET endpoint. Transient HTTP responses use the runtime retry/circuit protections.', 'database':'The SQL step uses a named parameter and a configured database connection.', 'email':'An email template and server-side email connection deliver the quote. Demo mode sends nothing.', 'integration':'Choose an installed integration and its action/fields in the designer.', 'transfer':'Select a target chatbot and map the customer context. Demo mode stays in Atlas.'}[typ],l)
 gate('gate_'+typ,key,demo,l);edge('live_action_route','gate_'+typ,choice)
 edge(demo,'automation_return');edge(key,'automation_return')
msg('automation_return','Demo completed, or live step returned. Inspect the step run to see inputs, status, output, and any errors. Failed live calls also reach this recovery message.',l);nodes[-1]['config']['runAfter']={'succeeded':True,'failed':True,'skipped':True,'timedOut':True}
node('event_button','button','Host event demo',{'text':'Emit a demo event to the host page, then continue. This is a browser event, not a Slack/Jira delivery.','buttons':[{'id':'atlas_event','label':'Emit Atlas event','value':'sent','listeners':[{'id':'emit','event':'click','action':'emit_event','eventName':'atlas_demo_completed','eventPayload':'{"journey":"automation"}'},{'id':'continue','event':'click','action':'continue'}]}]},l)
back('automation_back',l);chain('automation_intro','demo_automation','quote_total','automation_summary','live_action','live_action_route');edge('live_action_route','automation_return','default');chain('automation_return','event_button','automation_back')
# response playground, grouped so visitor avoids a 47-question marathon
l=6
sets={'Text & contact':['text','long_text','name','email','phone','url','address','postal_code','country','gender'], 'Numbers & ratings':['number','stepper','slider','percentage','currency','rating','stars','nps','likert','mood','thumbs'], 'Choices & planning':['choice','numbered_choice','autocomplete','ranking','matrix','date','time','datetime','appointment','color','boolean','confirm'], 'Files & interaction':['file','signature','location','audio','image_choice','form'], 'Security controls':['captcha','otp','national_id','password','credit_card']}
q('playground','Pick a response family. Every question is optional. Use fictional values only.','choice',l,choices=list(sets))
node('playground_route','switch','Response family router',{'value':'{{vars.playground}}','cases':[dict(id='family'+str(i),match=name) for i,name in enumerate(sets)]},l);edge('playground','playground_route')
for i,(name,types) in enumerate(sets.items()):
 lane=7+i;keys=[]
 for typ in types:
  cfg={'answerRequired':False}
  if typ in ['choice','numbered_choice','autocomplete','ranking','matrix']:cfg['choices']=['Explore','Relax','Learn']
  if typ=='matrix':cfg['scaleChoices']=['Low','Medium','High']
  if typ in ['number','stepper','slider','rating','stars','nps','percentage']:cfg.update(min=0,max=10 if typ!='percentage' else 100,step=1)
  if typ=='currency':cfg['currencyCode']='ZAR'
  if typ=='form':cfg['formFields']=[dict(key='nickname',label='Fictional nickname',type='text',required=True)]
  if typ=='image_choice':cfg['imageChoices']=[dict(label=a,filename=b) for a,b in [('Explore','atlas-explore.svg'),('Relax','atlas-relax.svg'),('Learn','atlas-learn.svg')]]
  if typ=='national_id':cfg['idFormat']='any'
  if typ=='captcha':cfg['captchaKind']='math'
  if typ=='otp':cfg['otpLength']=6
  prompt='Try the '+typ.replace('_',' ')+' response, or skip.'
  if typ in ['password','credit_card','national_id']:prompt+=' UI demonstration only: never enter real credentials, card details or identity numbers.'
  if typ=='otp':prompt+=' Format-only demo: enter 123456. No code is delivered or identity verified.'
  if typ=='image_choice':prompt+=' Requires the three supplied SVGs to be uploaded to this chatbot media library.'
  key='try_'+typ
  config=dict(prompt=prompt,answerType=typ,outputVariable=key,**cfg)
  node(key,'question','Try '+typ,config,lane);keys.append(key)
 msg('family_done_'+str(i),'That completes '+name+'. Your answers are visible in the preview variables and run history.',lane);back('family_back_'+str(i),lane);keys+=['family_done_'+str(i),'family_back_'+str(i)];chain(*keys);edge('playground_route',keys[0],'family'+str(i))
edge('playground_route','hub','default')
# gallery
l=12;msg('gallery_intro','**Reusable content, one conversation.** This gallery combines templates, documents, maps, QR codes and rich presentation.',l)
msg('gallery_message','{{templates.atlas_message.text}}',l)
msg('gallery_hours','{{embed(templates.atlas_hours)}}',l)
msg('gallery_map','{{embed(templates.atlas_map)}}',l)
msg('gallery_qr','{{embed(templates.atlas_qr)}}',l)
msg('gallery_whatsapp','{{embed(templates.atlas_whatsapp)}}',l)
msg('gallery_social','{{templates.atlas_social_share.text}}',l)
msg('gallery_certificate','{{templates.atlas_certificate.file}}',l)
msg('gallery_agreement','{{templates.atlas_agreement.file}}',l)
msg('gallery_checklist','{{templates.atlas_checklist.file}}',l)
msg('gallery_faq','{{templates.atlas_faq.text}}\n\n{{templates.atlas_pricing.text}}',l)
msg('gallery_finish','The Templates area also includes appointment, location, team, survey, announcement, SMS, push, ticket, consent and webhook blueprints. They are editable resources; adding a template alone does not send a notification.',l);back('gallery_back',l);chain('gallery_intro','gallery_message','gallery_hours','gallery_map','gallery_qr','gallery_whatsapp','gallery_social','gallery_certificate','gallery_agreement','gallery_checklist','gallery_faq','gallery_finish','gallery_back')
# identity
l=13;msg('identity_intro','**Identity and personalisation**\nDemo mode uses a fictional profile, never claims to authenticate you, and makes no sign-in request.',l)
gate('identity_mode','identity_live','identity_demo',l)
setv('identity_demo',[('demoIdentity',{'id':'demo-explorer','name':'Atlas Explorer','verified':False},'object')],l)
node('identity_live','sign_in','LIVE: configure identity endpoint',dict(mode='http',connectionId='',prompt='Sign in to Atlas',userIdPath='user.id',tokenPath='token',profilePath='user',userIdVariable='signedInId',tokenVariable='authToken',profileVariable='signedInProfile'),l)
msg('identity_result','Demo profile: {{vars.demoIdentity}}\nLive identity details, if enabled, are available in the sign-in step outputs. The playground includes a captcha; OTP delivery requires an email connection.',l);back('identity_back',l);chain('identity_intro','identity_mode');chain('identity_demo','identity_result','identity_back');edge('identity_live','identity_result')
# feedback
l=14;msg('feedback_intro','**Close the loop.** Capture satisfaction, branch on sentiment, and review the journey in Analytics.',l)
q('satisfaction','How was the Atlas experience?','nps',l,min=0,max=10)
node('sentiment_route','condition','Low score recovery',dict(left='{{vars.satisfaction}}',operator='lt',right='7'),l)
msg('recover','Thank you for the honest feedback. What should we improve?',l);msg('celebrate','Glad you enjoyed the tour. What stood out?',l)
q('feedback_comment','Share your thoughts.','long_text',l,maxLength=1000)
entity('save_feedback','create','atlas_feedback',l,outputVariable='feedback',fieldMap={'rating':'{{vars.satisfaction}}','comment':'{{vars.feedback_comment}}'})
msg('analytics_notes','**Behind the scenes**\nAnalytics can show session journeys, step timings, failures and bottlenecks. Runtime intelligence flags anomalies and regressions when enough data exists. Operations forecasts and routing suggestions need real queue/agent data. Designer intelligence highlights cycles, dead paths and complexity.',l);back('feedback_back',l);chain('feedback_intro','satisfaction','sentiment_route');edge('sentiment_route','recover','true');edge('sentiment_route','celebrate','false');edge('recover','feedback_comment');edge('celebrate','feedback_comment');chain('feedback_comment','save_feedback','analytics_notes','feedback_back')
# finale restart / end
q('finish','One last thing: restart the tour or finish?','choice',0,choices=['Restart','Finish'])
node('finish_route','condition','Restart or finish',dict(left='{{vars.finish}}',operator='eq',right='Restart'));node('restart_demo','restart','Restart Atlas',{'clearCookies':False});node('end','end','Until next time',{'message':'Thanks for exploring Atlas, {{vars.displayName}}. Your next great chatbot starts here.'});edge('finish','finish_route');edge('finish_route','restart_demo','true');edge('finish_route','end','false')
pack=dict(kind='flowforge.chatbotFlow',version=1,exportedAt='2026-09-23T00:00:00.000Z',chatbot=dict(id=uid('chatbot'),name='FlowForge Atlas - Capability Showcase',description='A multi-journey, demo-first showcase of FlowForge. Configure marked LIVE steps before enabling integrations.'),flow=dict(id=uid('flow'),name='Atlas Experience Engine',version=1),globals=globals,nodes=nodes,edges=edges,entities=[dict(id=e['id'],key=e['key']) for e in entities],entityDefs=entities,templates=[],testScenarios=[dict(name='Atlas demo mode',globals={'demoMode':True},expected={'stepKeys':['welcome','hub']})])
(out/'FlowForge-Atlas.json').write_text(json.dumps(pack,indent=2,ensure_ascii=False),encoding='utf-8')
print(len(nodes),'nodes',len(edges),'edges',len(entities),'entities')
