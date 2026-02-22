import './list.scss'
import Card from"../card/Card"

// Modified to accept deleteAction
function List({posts, deleteAction}){ 
  return (
    <div className='list'>
      {posts.map(item=>(
        <Card 
            key={item.id} 
            item={item} 
            deleteAction={deleteAction} // <--- ACTION PASSED DOWN
        />
      ))}
    </div>
  )
}

export default List