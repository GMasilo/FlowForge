import {readFileSync} from 'node:fs'
import {it,expect} from 'vitest'
import {parseFlowExport} from '../src/features/designer/utils/flowTransfer'
import {validateFlow} from '../src/features/designer/validation/referenceValidator'
import {buildLinearItems} from '../src/features/designer/utils/conditionGraph'
import {findSiblingContext} from '../src/features/designer/utils/sequenceEdit'
it('opens the student showcase in the designer',()=>{
 const pack=parseFlowExport(JSON.parse(readFileSync(new URL('../public/samples/flowforge-usecase-student-lifecycle.json',import.meta.url),'utf8')))
 const started=performance.now()
 validateFlow(pack.nodes,pack.edges,{globalVariables:pack.globals.map(g=>g.key)})


 expect(buildLinearItems(pack.nodes,pack.edges).length).toBeGreaterThan(0)
 for(const n of pack.nodes) findSiblingContext(pack.nodes,pack.edges,n.id)
 expect(performance.now()-started).toBeLessThan(10000)
},15000)


