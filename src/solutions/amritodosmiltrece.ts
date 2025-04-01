import type {
  API,
  FinalizedEvent,
  IncomingEvent,
  NewBlockEvent,
  NewTransactionEvent,
  OutputAPI,
  Settled
} from "../types"

export default function amritodosmiltrece(api: API, outputApi: OutputAPI) {
    // Requirements:
    //
    // 1) When a transaction becomes "settled"-which always occurs upon receiving a "newBlock" event-
    //    you must call `outputApi.onTxSettled`.
    //
    //    - Multiple transactions may settle in the same block, so `onTxSettled` could be called
    //      multiple times per "newBlock" event.
    //    - Ensure callbacks are invoked in the same order as the transactions originally arrived.
    //
    // 2) When a transaction becomes "done"-meaning the block it was settled in gets finalized-
    //    you must call `outputApi.onTxDone`.
    //
    //    - Multiple transactions may complete upon a single "finalized" event.
    //    - As above, maintain the original arrival order when invoking `onTxDone`.
    //    - Keep in mind that the "finalized" event is not emitted for all finalized blocks.
    //
    // Notes:
    // - It is **not** ok to make redundant calls to either `onTxSettled` or `onTxDone`.
    // - It is ok to make redundant calls to `getBody`, `isTxValid` and `isTxSuccessful`
    //
    // Bonus 1:
    // - Avoid making redundant calls to `getBody`, `isTxValid` and `isTxSuccessful`.
    //
    // Bonus 2:
    // - Upon receiving a "finalized" event, call `api.unpin` to unpin blocks that are either:
    //     a) pruned, or
    //     b) older than the currently finalized block.
    const transactions: any[] = []
    const settledBlocks: any[] = []
    const settledTransactions: any[]= []

    const onNewBlock = ({ blockHash, parent }: NewBlockEvent) => {
      if (!settledBlocks.includes(parent)){ 
        const body = api.getBody(blockHash)
        for (let i = 0; i < transactions.length; i ++) {
          const t = transactions[i]
          if (t !== undefined){
          if (body.includes(t)){
            if (api.isTxValid(blockHash, t)){
              if (api.isTxSuccessful(blockHash, t)) {
                const status: Settled = { 
                  blockHash: blockHash,
                  type: "valid",
                  successful: true
                }; 
                settledTransactions.push([blockHash, t])
                outputApi.onTxSettled(t, status) 
                transactions.splice(i, 1)
              }
            }else {
              const status: Settled = { 
                blockHash: blockHash,
                type: "invalid",
              };
              outputApi.onTxSettled(t, status) 
              transactions.splice(i, 1)
              }
            } 
          }
        }
      }
    }
    const onNewTx = ({ value: transaction }: NewTransactionEvent) => {
      transactions.push(transaction)
    }

    const onFinalized = ({ blockHash }: FinalizedEvent) => {
      settledBlocks.push(blockHash)
      for (let i=0; i < settledTransactions.length; i ++){
        const st = settledTransactions[i]
        if (st[0] === blockHash) {
          const status: Settled = { 
            blockHash: blockHash,
            type: "valid",
            successful: true
          }; 
          outputApi.onTxDone(st[1], status) 
          settledTransactions.splice(i, 1)
        }
      }
    }
    return (event: IncomingEvent) => {
    switch (event.type) {
      case "newBlock": {
        onNewBlock(event)
        break
      }
      case "newTransaction": {
        onNewTx(event)
        break
      }
      case "finalized":
        onFinalized(event)
  }
  }
}
